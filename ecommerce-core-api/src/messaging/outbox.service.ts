import { hostname } from 'node:os';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { QueryExecutor } from '../database/query-executor';
import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../observability/metrics.service';
import { MESSAGE_PUBLISHER, type MessagePublisher } from './publisher.interface';

export interface EnqueueOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  deduplicationKey?: string;
}

export interface ClaimedOutboxEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  attempt_count: number;
  deduplication_key: string;
  created_at: Date;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
    private readonly metricsService: MetricsService,
  ) {}

  async enqueueInTransaction(
    db: QueryExecutor,
    input: EnqueueOutboxEventInput,
  ): Promise<string> {
    const id = uuidv4();
    const deduplicationKey =
      input.deduplicationKey ?? `${input.eventType}:${input.aggregateType}:${input.aggregateId}:${id}`;
    const result = await db.query<{ id: string }>(
      `INSERT INTO outbox_events (
         id, aggregate_type, aggregate_id, event_type, payload, headers, status,
         next_attempt_at, deduplication_key
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'pending', NOW(), $7)
       ON CONFLICT (deduplication_key) WHERE deduplication_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        id,
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        JSON.stringify(input.payload),
        JSON.stringify(input.headers ?? {}),
        deduplicationKey,
      ],
    );
    if (result.rows[0]?.id) {
      return result.rows[0].id;
    }
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM outbox_events WHERE deduplication_key = $1 LIMIT 1`,
      [deduplicationKey],
    );
    if (!existing.rows[0]?.id) {
      throw new Error('Outbox deduplication conflict could not be resolved');
    }
    return existing.rows[0].id;
  }

  enqueueStandalone(input: EnqueueOutboxEventInput): Promise<string> {
    return this.enqueueInTransaction(this.databaseService.db, input);
  }

  /** Compatibility alias for non-transactional, non-checkout producers. */
  enqueue(input: EnqueueOutboxEventInput): Promise<string> {
    return this.enqueueStandalone(input);
  }

  async recoverStaleProcessing(timeoutSeconds = this.processingTimeoutSeconds()): Promise<number> {
    const result = await this.databaseService.db.query(
      `UPDATE outbox_events
       SET status = 'pending', locked_at = NULL, locked_by = NULL,
           next_attempt_at = NOW(), updated_at = NOW(),
           last_error = COALESCE(last_error, 'stale processing lock recovered')
       WHERE status = 'processing'
         AND locked_at < NOW() - ($1::int * INTERVAL '1 second')`,
      [timeoutSeconds],
    );
    const recovered = result.rowCount ?? 0;
    if (recovered > 0) {
      this.metricsService.incrementCounter('outbox_stale_recovered_total', undefined, recovered);
    }
    return recovered;
  }

  async claimBatch(limit: number, workerId: string): Promise<ClaimedOutboxEvent[]> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ClaimedOutboxEvent>(
        `WITH candidates AS (
           SELECT id
           FROM outbox_events
           WHERE status = 'pending' AND next_attempt_at <= NOW()
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         )
         UPDATE outbox_events event
         SET status = 'processing', locked_at = NOW(), locked_by = $2, updated_at = NOW()
         FROM candidates
         WHERE event.id = candidates.id
         RETURNING event.id, event.aggregate_type, event.aggregate_id, event.event_type,
                   event.payload, event.headers, event.attempt_count,
                   event.deduplication_key, event.created_at`,
        [limit, workerId],
      );
      await client.query('COMMIT');
      if (result.rows.length > 0) {
        this.metricsService.incrementCounter('outbox_claimed_total', undefined, result.rows.length);
      }
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async publishPending(
    limit = this.batchSize(),
    beforePublish?: (event: ClaimedOutboxEvent) => Promise<void>,
    workerId = `${hostname()}:${process.pid}:${uuidv4()}`,
  ): Promise<number> {
    const rows = await this.claimBatch(limit, workerId);
    let publishedCount = 0;
    for (const row of rows) {
      try {
        if (beforePublish) {
          await beforePublish(row);
        }
        await this.publishEvent(row);
        await this.markPublished(row.id, workerId);
        publishedCount += 1;
        this.metricsService.incrementCounter('outbox_published_total');
      } catch (error) {
        const message = this.safeError(error);
        this.logger.error(`Outbox publish failed for ${row.id}: ${message}`);
        const failed = await this.markPublishFailure(row, workerId, message);
        this.metricsService.incrementCounter(failed ? 'outbox_failed_total' : 'outbox_retry_total');
      }
    }
    return publishedCount;
  }

  private async publishEvent(row: ClaimedOutboxEvent): Promise<void> {
    await this.publisher.publish({
      routingKey: row.event_type,
      payload: {
        eventId: row.id,
        outboxId: row.id,
        eventType: row.event_type,
        aggregateId: row.aggregate_id,
        aggregateType: row.aggregate_type,
        occurredAt: row.created_at.toISOString(),
        timestamp: row.created_at.toISOString(),
        schemaVersion: 1,
        requestId: typeof row.payload.requestId === 'string' ? row.payload.requestId : null,
        actor: row.payload.actor ?? null,
        deduplicationKey: row.deduplication_key,
        payload: row.payload,
        data: row.payload,
      },
      headers: {
        ...row.headers,
        outboxId: row.id,
        eventType: row.event_type,
        aggregateId: row.aggregate_id,
        schemaVersion: '1',
        deduplicationKey: row.deduplication_key,
      },
    });
  }

  private async markPublished(id: string, workerId: string): Promise<void> {
    const result = await this.databaseService.db.query(
      `UPDATE outbox_events
       SET status = 'published', published_at = NOW(), locked_at = NULL, locked_by = NULL,
           updated_at = NOW(), attempt_count = attempt_count + 1, last_error = NULL
       WHERE id = $1 AND status = 'processing' AND locked_by = $2`,
      [id, workerId],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new Error('Outbox publish acknowledgement lost worker ownership');
    }
  }

  private async markPublishFailure(
    row: ClaimedOutboxEvent,
    workerId: string,
    message: string,
  ): Promise<boolean> {
    const nextAttemptCount = row.attempt_count + 1;
    const maxAttempts = this.maxAttempts();
    const terminal = nextAttemptCount >= maxAttempts;
    const delayMs = this.backoffMs(nextAttemptCount);
    const result = await this.databaseService.db.query(
      `UPDATE outbox_events
       SET status = $3, attempt_count = attempt_count + 1,
           next_attempt_at = CASE WHEN $3 = 'failed' THEN next_attempt_at
                                  ELSE NOW() + ($4::int * INTERVAL '1 millisecond') END,
           locked_at = NULL, locked_by = NULL, updated_at = NOW(), last_error = LEFT($5, 1000)
       WHERE id = $1 AND status = 'processing' AND locked_by = $2`,
      [row.id, workerId, terminal ? 'failed' : 'pending', delayMs, message],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new Error('Outbox failure acknowledgement lost worker ownership');
    }
    return terminal;
  }

  private backoffMs(attempt: number): number {
    const base = this.baseBackoffMs();
    const exponential = Math.min(base * 2 ** Math.max(0, attempt - 1), 3_600_000);
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential * 0.2)));
    return exponential + jitter;
  }

  private safeError(error: unknown): string {
    const raw = error instanceof Error ? error.message : 'Failed to publish message';
    return raw.replace(/(password|token|secret|authorization)=?[^\s,;]*/gi, '$1=[redacted]');
  }

  private batchSize(): number {
    return this.integerEnv('OUTBOX_BATCH_SIZE', 100, 1, 1000);
  }

  private maxAttempts(): number {
    return this.integerEnv('OUTBOX_MAX_ATTEMPTS', 5, 1, 100);
  }

  private baseBackoffMs(): number {
    return this.integerEnv('OUTBOX_BASE_BACKOFF_MS', 1000, 100, 300_000);
  }

  private processingTimeoutSeconds(): number {
    return this.integerEnv('OUTBOX_PROCESSING_TIMEOUT_SECONDS', 120, 5, 3600);
  }

  private integerEnv(name: string, fallback: number, min: number, max: number): number {
    const value = Number(process.env[name] ?? fallback);
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  }
}
