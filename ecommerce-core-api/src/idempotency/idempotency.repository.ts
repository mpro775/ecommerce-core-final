import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { QueryExecutor } from '../database/query-executor';

export interface IdempotencyKeyRecord {
  id: string;
  store_id: string;
  operation: string;
  idempotency_key: string;
  actor_id: string | null;
  request_hash: string;
  status: 'processing' | 'completed' | 'failed';
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  order_id: string | null;
  processing_started_at: Date;
  completed_at: Date | null;
  failed_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}
const RETURNING_FIELDS = `
  id, store_id, operation, idempotency_key, actor_id, request_hash, status,
  response_status, response_body, order_id, processing_started_at, completed_at,
  failed_at, last_error, created_at, updated_at, expires_at
`;

@Injectable()
export class IdempotencyRepository {
  async claim(
    db: QueryExecutor,
    input: {
      storeId: string;
      operation: string;
      key: string;
      actorId: string | null;
      requestHash: string;
      expiresAt: Date;
    },
  ): Promise<IdempotencyKeyRecord | null> {
    await db.query(
      `DELETE FROM idempotency_keys
       WHERE store_id = $1 AND operation = $2 AND idempotency_key = $3
         AND status <> 'processing' AND expires_at <= NOW()`,
      [input.storeId, input.operation, input.key],
    );
    const result = await db.query<IdempotencyKeyRecord>(
      `INSERT INTO idempotency_keys (
         id, store_id, operation, idempotency_key, actor_id, request_hash, status,
         processing_started_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'processing', NOW(), $7)
       ON CONFLICT (store_id, operation, idempotency_key) DO NOTHING
       RETURNING ${RETURNING_FIELDS}`,
      [
        uuidv4(),
        input.storeId,
        input.operation,
        input.key,
        input.actorId,
        input.requestHash,
        input.expiresAt,
      ],
    );
    return result.rows[0] ?? null;
  }

  async find(
    db: QueryExecutor,
    storeId: string,
    operation: string,
    key: string,
  ): Promise<IdempotencyKeyRecord | null> {
    const result = await db.query<IdempotencyKeyRecord>(
      `SELECT ${RETURNING_FIELDS}
       FROM idempotency_keys
       WHERE store_id = $1 AND operation = $2 AND idempotency_key = $3
       LIMIT 1`,
      [storeId, operation, key],
    );
    return result.rows[0] ?? null;
  }

  async complete(
    db: QueryExecutor,
    input: {
      recordId: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
      orderId: string;
    },
  ): Promise<void> {
    const result = await db.query(
      `UPDATE idempotency_keys
       SET status = 'completed', response_status = $2, response_body = $3::jsonb,
           order_id = $4, completed_at = NOW(), failed_at = NULL, last_error = NULL,
           updated_at = NOW()
       WHERE id = $1 AND status = 'processing'`,
      [input.recordId, input.responseStatus, JSON.stringify(input.responseBody), input.orderId],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new Error('Idempotency completion lost ownership');
    }
  }

  async fail(
    db: QueryExecutor,
    input: {
      recordId: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
      lastError: string;
    },
  ): Promise<void> {
    const result = await db.query(
      `UPDATE idempotency_keys
       SET status = 'failed', response_status = $2, response_body = $3::jsonb,
           failed_at = NOW(), last_error = LEFT($4, 500), updated_at = NOW()
       WHERE id = $1 AND status = 'processing'`,
      [input.recordId, input.responseStatus, JSON.stringify(input.responseBody), input.lastError],
    );
    if ((result.rowCount ?? 0) !== 1) {
      throw new Error('Idempotency failure finalization lost ownership');
    }
  }

  async deleteExpired(db: QueryExecutor): Promise<number> {
    const result = await db.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW() AND status <> 'processing'`,
    );
    return result.rowCount ?? 0;
  }
}
