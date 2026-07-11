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
  attempt_number: number;
  delivered_at: Date | null;
  next_retry_at: Date | null;
  error_message: string | null;
  created_at: Date;
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

  async createDelivery(input: {
    storeId: string;
    endpointId: string;
    eventType: string;
    payload: Record<string, unknown>;
    signature: string;
    requestHeaders: Record<string, unknown>;
  }): Promise<WebhookDeliveryRecord> {
    const result = await this.databaseService.db.query<WebhookDeliveryRecord>(
      `
        INSERT INTO webhook_deliveries (
          id,
          store_id,
          endpoint_id,
          event_type,
          payload,
          signature,
          request_headers,
          attempt_number
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, 1)
        RETURNING id, store_id, endpoint_id, event_type, payload, signature, request_headers,
                  response_status, response_body, response_headers, attempt_number,
                  delivered_at, next_retry_at, error_message, created_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.endpointId,
        input.eventType,
        JSON.stringify(input.payload),
        input.signature,
        JSON.stringify(input.requestHeaders),
      ],
    );

    return result.rows[0] as WebhookDeliveryRecord;
  }

  async markDeliverySuccess(input: {
    deliveryId: string;
    endpointId: string;
    responseStatus: number;
    responseBody: string | null;
    responseHeaders: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE webhook_deliveries
        SET delivered_at = NOW(),
            next_retry_at = NULL,
            response_status = $2,
            response_body = $3,
            response_headers = $4::jsonb,
            error_message = NULL
        WHERE id = $1
      `,
      [
        input.deliveryId,
        input.responseStatus,
        input.responseBody,
        JSON.stringify(input.responseHeaders),
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
    responseStatus: number | null;
    responseBody: string | null;
    responseHeaders: Record<string, unknown> | null;
    errorMessage: string;
    nextRetryAt: Date | null;
    nextAttemptNumber: number;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE webhook_deliveries
        SET response_status = $2,
            response_body = $3,
            response_headers = $4::jsonb,
            error_message = $5,
            next_retry_at = $6,
            attempt_number = $7
        WHERE id = $1
      `,
      [
        input.deliveryId,
        input.responseStatus,
        input.responseBody,
        JSON.stringify(input.responseHeaders ?? {}),
        input.errorMessage,
        input.nextRetryAt,
        input.nextAttemptNumber,
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
               d.attempt_number,
               d.delivered_at,
               d.next_retry_at,
               d.error_message,
               d.created_at,
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
      where.push('delivered_at IS NOT NULL');
    }

    if (input.status === 'failed') {
      where.push('delivered_at IS NULL AND next_retry_at IS NULL AND error_message IS NOT NULL');
    }

    if (input.status === 'pending') {
      where.push('delivered_at IS NULL AND next_retry_at IS NOT NULL');
    }

    values.push(input.limit);
    values.push(input.offset);

    const whereClause = where.join(' AND ');

    const [rowsResult, countResult] = await Promise.all([
      this.databaseService.db.query<WebhookDeliveryRecord>(
        `
          SELECT id, store_id, endpoint_id, event_type, payload, signature, request_headers,
                 response_status, response_body, response_headers, attempt_number,
                 delivered_at, next_retry_at, error_message, created_at
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

  async listPendingRetries(limit: number): Promise<WebhookDeliveryWithEndpointRecord[]> {
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
               d.attempt_number,
               d.delivered_at,
               d.next_retry_at,
               d.error_message,
               d.created_at,
               e.url AS endpoint_url,
               e.secret_key AS endpoint_secret_key
        FROM webhook_deliveries d
        INNER JOIN webhook_endpoints e
          ON e.id = d.endpoint_id
        WHERE d.delivered_at IS NULL
          AND d.next_retry_at IS NOT NULL
          AND d.next_retry_at <= NOW()
          AND e.is_active = TRUE
        ORDER BY d.next_retry_at ASC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows;
  }
}
