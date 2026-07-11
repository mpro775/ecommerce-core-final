import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { MESSAGE_PUBLISHER, type MessagePublisher } from './publisher.interface';

export interface EnqueueOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
  ) {}

  async enqueue(input: EnqueueOutboxEventInput): Promise<string> {
    const id = uuidv4();
    await this.databaseService.db.query(
      `
        INSERT INTO outbox_events (
          id,
          aggregate_type,
          aggregate_id,
          event_type,
          payload,
          headers,
          status,
          available_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `,
      [
        id,
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        input.payload,
        input.headers ?? {},
      ],
    );
    return id;
  }

  async publishPending(limit = 100): Promise<number> {
    const rows = await this.fetchPending(limit);
    let publishedCount = 0;

    for (const row of rows) {
      try {
        await this.publishEvent(row);
        await this.markPublished(row.id);

        publishedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to publish message';
        this.logger.error(`Outbox publish failed for ${row.id}: ${message}`);
        await this.markFailed(row.id, message);
      }
    }

    return publishedCount;
  }

  private async fetchPending(limit: number): Promise<
    Array<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      headers: Record<string, string>;
    }>
  > {
    const rows = await this.databaseService.db.query<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      headers: Record<string, string>;
    }>(
      `
        SELECT id, event_type, payload, headers
        FROM outbox_events
        WHERE status = 'pending'
          AND available_at <= NOW()
        ORDER BY created_at ASC
        LIMIT $1
      `,
      [limit],
    );

    return rows.rows;
  }

  private async publishEvent(row: {
    id: string;
    event_type: string;
    payload: Record<string, unknown>;
    headers: Record<string, string>;
  }): Promise<void> {
    await this.publisher.publish({
      routingKey: row.event_type,
      payload: row.payload,
      headers: {
        ...row.headers,
        outboxId: row.id,
      },
    });
  }

  private async markPublished(id: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE outbox_events
        SET status = 'published',
            published_at = NOW(),
            updated_at = NOW(),
            attempt_count = attempt_count + 1,
            last_error = NULL
        WHERE id = $1
      `,
      [id],
    );
  }

  private async markFailed(id: string, message: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE outbox_events
        SET status = CASE WHEN attempt_count >= 5 THEN 'failed' ELSE 'pending' END,
            attempt_count = attempt_count + 1,
            available_at = NOW() + ((attempt_count + 1) * INTERVAL '10 seconds'),
            updated_at = NOW(),
            last_error = $2
        WHERE id = $1
      `,
      [id, message],
    );
  }
}
