import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface WebhookEndpointRecord {
  id: string;
  store_id: string;
  name: string;
  url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: Date | null;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDeliveryRecord {
  id: string;
  store_id: string;
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  signature: string;
  request_headers: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  response_headers: Record<string, unknown> | null;
  status: 'pending' | 'processing' | 'delivered' | 'failed';
  attempt_count: number;
  delivered_at: Date | null;
  next_attempt_at: Date | null;
  locked_at: Date | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  source_outbox_event_id: string | null;
}

export interface WebhookDeliveryWithEndpointRecord extends WebhookDeliveryRecord {
  endpoint_url: string;
  endpoint_secret_key: string;
}

@Injectable()
export class WebhooksRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createEndpoint(input: {
    storeId: string;
    name: string;
    url: string;
    secretKey: string;
    events: string[];
    isActive: boolean;
  }): Promise<WebhookEndpointRecord> {
    const result = await this.databaseService.db.query<WebhookEndpointRecord>(
      `
        INSERT INTO webhook_endpoints (
          id,
          store_id,
          name,
          url,
          secret_key,
          events,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        RETURNING id, store_id, name, url, secret_key, events, is_active,
                  last_triggered_at, failure_count, created_at, updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.url,
        input.secretKey,
        JSON.stringify(input.events),
        input.isActive,
      ],
    );

    return result.rows[0] as WebhookEndpointRecord;
  }

  async listEndpoints(storeId: string): Promise<WebhookEndpointRecord[]> {
    const result = await this.databaseService.db.query<WebhookEndpointRecord>(
      `
        SELECT id, store_id, name, url, secret_key, events, is_active,
               last_triggered_at, failure_count, created_at, updated_at
        FROM webhook_endpoints
        WHERE store_id = $1
        ORDER BY created_at DESC
      `,
      [storeId],
    );

    return result.rows;
  }

  async findEndpointById(
    storeId: string,
    endpointId: string,
  ): Promise<WebhookEndpointRecord | null> {
    const result = await this.databaseService.db.query<WebhookEndpointRecord>(
      `
        SELECT id, store_id, name, url, secret_key, events, is_active,
               last_triggered_at, failure_count, created_at, updated_at
        FROM webhook_endpoints
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, endpointId],
    );

    return result.rows[0] ?? null;
  }

  async updateEndpoint(input: {
    storeId: string;
    endpointId: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
  }): Promise<WebhookEndpointRecord | null> {
    const result = await this.databaseService.db.query<WebhookEndpointRecord>(
      `
        UPDATE webhook_endpoints
        SET name = $3,
            url = $4,
            events = $5::jsonb,
            is_active = $6,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, name, url, secret_key, events, is_active,
                  last_triggered_at, failure_count, created_at, updated_at
      `,
      [
        input.storeId,
        input.endpointId,
        input.name,
        input.url,
        JSON.stringify(input.events),
        input.isActive,
      ],
    );

    return result.rows[0] ?? null;
  }

  async deleteEndpoint(storeId: string, endpointId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM webhook_endpoints
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, endpointId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listActiveEndpointsForEvent(
    storeId: string,
    eventType: string,
  ): Promise<WebhookEndpointRecord[]> {
    const result = await this.databaseService.db.query<WebhookEndpointRecord>(
      `
        SELECT id, store_id, name, url, secret_key, events, is_active,
               last_triggered_at, failure_count, created_at, updated_at
        FROM webhook_endpoints
        WHERE store_id = $1
          AND is_active = TRUE
          AND events ? $2
        ORDER BY created_at ASC
      `,
      [storeId, eventType],
    );

    return result.rows;
  }

  async createOrGetDeliveryFromOutbox(input: {
    sourceOutboxId: string;
    storeId: string;
    endpointId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature: string;
    requestHeaders: Record<string, unknown>;
  }): Promise<WebhookDeliveryRecord> {
    const result = await this.databaseService.db.query<WebhookDeliveryRecord>(
      `INSERT INTO webhook_deliveries (
         id, store_id, endpoint_id, event_type, payload, signature, request_headers,
         status, attempt_count, next_attempt_at, source_outbox_event_id
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, 'pending', 0, NOW(), $8)
       ON CONFLICT (endpoint_id, source_outbox_event_id)
         WHERE source_outbox_event_id IS NOT NULL
       DO UPDATE SET
         next_attempt_at = CASE
           WHEN webhook_deliveries.status IN ('pending', 'failed')
             THEN LEAST(COALESCE(webhook_deliveries.next_attempt_at, NOW()), NOW())
           ELSE webhook_deliveries.next_attempt_at
         END,
         updated_at = NOW()
       RETURNING id, store_id, endpoint_id, event_type, payload, signature, request_headers,
                 response_status, response_body, response_headers, status, attempt_count,
                 delivered_at, next_attempt_at, locked_at, locked_by, last_error,
                 created_at, updated_at, source_outbox_event_id`,
      [uuidv4(), input.storeId, input.endpointId, input.eventType, JSON.stringify(input.payload),
       input.signature, JSON.stringify(input.requestHeaders), input.sourceOutboxId],
    );
    return result.rows[0] as WebhookDeliveryRecord;
  }

  async claimDueDeliveries(limit: number, workerId: string): Promise<WebhookDeliveryWithEndpointRecord[]> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<WebhookDeliveryWithEndpointRecord>(
        `WITH candidates AS (
           SELECT d.id
           FROM webhook_deliveries d
           JOIN webhook_endpoints e ON e.id = d.endpoint_id AND e.is_active = TRUE
           WHERE d.status IN ('pending', 'failed')
             AND d.next_attempt_at IS NOT NULL
             AND d.next_attempt_at <= NOW()
           ORDER BY d.next_attempt_at, d.created_at
           FOR UPDATE OF d SKIP LOCKED
           LIMIT $1
         ), claimed AS (
           UPDATE webhook_deliveries d
           SET status = 'processing', locked_at = NOW(), locked_by = $2,
               attempt_count = attempt_count + 1, updated_at = NOW()
           FROM candidates c
           WHERE d.id = c.id
           RETURNING d.*
         )
         SELECT c.id, c.store_id, c.endpoint_id, c.event_type, c.payload, c.signature,
                c.request_headers, c.response_status, c.response_body, c.response_headers,
                c.status, c.attempt_count, c.delivered_at, c.next_attempt_at,
                c.locked_at, c.locked_by, c.last_error, c.created_at, c.updated_at,
                c.source_outbox_event_id, e.url AS endpoint_url,
                e.secret_key AS endpoint_secret_key
         FROM claimed c
         JOIN webhook_endpoints e ON e.id = c.endpoint_id`,
        [limit, workerId],
      );
      await client.query('COMMIT');
      return result.rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recoverStaleProcessing(timeoutSeconds: number): Promise<number> {
    const result = await this.databaseService.db.query(
      `UPDATE webhook_deliveries
       SET status = 'pending', next_attempt_at = NOW(), locked_at = NULL, locked_by = NULL,
           last_error = COALESCE(last_error, 'stale processing lock recovered'), updated_at = NOW()
       WHERE status = 'processing'
         AND locked_at < NOW() - ($1::int * INTERVAL '1 second')`,
      [timeoutSeconds],
    );
    return result.rowCount ?? 0;
  }

  async markDeliverySuccess(input: {
    deliveryId: string;
    endpointId: string;
    workerId: string;
    responseStatus: number;
    responseBody: string | null;
    responseHeaders: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE webhook_deliveries
        SET status = 'delivered', delivered_at = NOW(),
            next_attempt_at = NULL, locked_at = NULL, locked_by = NULL,
            response_status = $2,
            response_body = $3,
            response_headers = $4::jsonb,
            last_error = NULL, updated_at = NOW()
        WHERE id = $1 AND status = 'processing' AND locked_by = $5
      `,
      [
        input.deliveryId,
        input.responseStatus,
        input.responseBody,
        JSON.stringify(input.responseHeaders), input.workerId,
      ],
    );

    await this.databaseService.db.query(
      `
        UPDATE webhook_endpoints
        SET failure_count = 0,
            last_triggered_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.endpointId],
    );
  }

  async markDeliveryFailure(input: {
    deliveryId: string;
    endpointId: string;
    workerId: string;
    responseStatus: number | null;
    responseBody: string | null;
    responseHeaders: Record<string, unknown> | null;
    errorMessage: string;
    nextAttemptAt: Date | null;
    terminal: boolean;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE webhook_deliveries
        SET status = $7,
            response_status = $2,
            response_body = $3,
            response_headers = $4::jsonb,
            last_error = LEFT($5, 1000),
            next_attempt_at = $6,
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE id = $1 AND status = 'processing' AND locked_by = $8
      `,
      [
        input.deliveryId,
        input.responseStatus,
        input.responseBody,
        JSON.stringify(input.responseHeaders ?? {}),
        input.errorMessage,
        input.nextAttemptAt,
        input.terminal ? 'failed' : 'pending',
        input.workerId,
      ],
    );

    await this.databaseService.db.query(
      `
        UPDATE webhook_endpoints
        SET failure_count = failure_count + 1,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.endpointId],
    );
  }

  async findDeliveryWithEndpoint(
    storeId: string,
    deliveryId: string,
  ): Promise<WebhookDeliveryWithEndpointRecord | null> {
    const result = await this.databaseService.db.query<WebhookDeliveryWithEndpointRecord>(
      `
        SELECT d.id,
               d.store_id,
               d.endpoint_id,
               d.event_type,
               d.payload,
               d.signature,
               d.request_headers,
               d.response_status,
               d.response_body,
               d.response_headers,
               d.status,
               d.attempt_count,
               d.delivered_at,
               d.next_attempt_at,
               d.locked_at,
               d.locked_by,
               d.last_error,
               d.created_at,
               d.updated_at,
               d.source_outbox_event_id,
               e.url AS endpoint_url,
               e.secret_key AS endpoint_secret_key
        FROM webhook_deliveries d
        INNER JOIN webhook_endpoints e
          ON e.id = d.endpoint_id
        WHERE d.store_id = $1
          AND d.id = $2
        LIMIT 1
      `,
      [storeId, deliveryId],
    );

    return result.rows[0] ?? null;
  }

  async listDeliveries(input: {
    storeId: string;
    endpointId?: string;
    eventType?: string;
    status?: 'success' | 'failed' | 'pending';
    limit: number;
    offset: number;
  }): Promise<{ rows: WebhookDeliveryRecord[]; total: number }> {
    const values: unknown[] = [input.storeId];
    const where: string[] = ['store_id = $1'];

    if (input.endpointId) {
      values.push(input.endpointId);
      where.push(`endpoint_id = $${values.length}`);
    }

    if (input.eventType) {
      values.push(input.eventType);
      where.push(`event_type = $${values.length}`);
    }

    if (input.status === 'success') {
      where.push(`status = 'delivered'`);
    }

    if (input.status === 'failed') {
      where.push(`status = 'failed'`);
    }

    if (input.status === 'pending') {
      where.push(`status IN ('pending', 'processing')`);
    }

    values.push(input.limit);
    values.push(input.offset);

    const whereClause = where.join(' AND ');

    const [rowsResult, countResult] = await Promise.all([
      this.databaseService.db.query<WebhookDeliveryRecord>(
        `
          SELECT id, store_id, endpoint_id, event_type, payload, signature, request_headers,
                 response_status, response_body, response_headers, status, attempt_count,
                 delivered_at, next_attempt_at, locked_at, locked_by, last_error,
                 created_at, updated_at, source_outbox_event_id
          FROM webhook_deliveries
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${values.length - 1}
          OFFSET $${values.length}
        `,
        values,
      ),
      this.databaseService.db.query<{ total: string }>(
        `
          SELECT COUNT(*)::text AS total
          FROM webhook_deliveries
          WHERE ${whereClause}
        `,
        values.slice(0, values.length - 2),
      ),
    ]);

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async scheduleRetry(storeId: string, deliveryId: string): Promise<WebhookDeliveryRecord | null> {
    const result = await this.databaseService.db.query<WebhookDeliveryRecord>(
      `UPDATE webhook_deliveries
       SET status = 'pending', next_attempt_at = NOW(), locked_at = NULL, locked_by = NULL,
           updated_at = NOW()
       WHERE store_id = $1 AND id = $2 AND status <> 'delivered'
       RETURNING id, store_id, endpoint_id, event_type, payload, signature, request_headers,
                 response_status, response_body, response_headers, status, attempt_count,
                 delivered_at, next_attempt_at, locked_at, locked_by, last_error,
                 created_at, updated_at, source_outbox_event_id`,
      [storeId, deliveryId],
    );
    return result.rows[0] ?? null;
  }
}
