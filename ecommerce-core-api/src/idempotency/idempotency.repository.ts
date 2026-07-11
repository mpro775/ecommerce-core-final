import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface IdempotencyKeyRecord {
  id: string;
  store_id: string;
  key: string;
  request_hash: string;
  response: Record<string, unknown>;
  order_id: string | null;
  created_at: Date;
  expires_at: Date;
}

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByStoreAndKey(storeId: string, key: string): Promise<IdempotencyKeyRecord | null> {
    const result = await this.databaseService.db.query<IdempotencyKeyRecord>(
      `SELECT id, store_id, key, request_hash, response, order_id, created_at, expires_at
       FROM idempotency_keys
       WHERE store_id = $1 AND key = $2`,
      [storeId, key],
    );
    return result.rows[0] ?? null;
  }

  async create(input: {
    storeId: string;
    key: string;
    requestHash: string;
    response: Record<string, unknown>;
    orderId?: string;
    expiresAt: Date;
  }): Promise<IdempotencyKeyRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<IdempotencyKeyRecord>(
      `INSERT INTO idempotency_keys (id, store_id, key, request_hash, response, order_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, store_id, key, request_hash, response, order_id, created_at, expires_at`,
      [
        id,
        input.storeId,
        input.key,
        input.requestHash,
        JSON.stringify(input.response),
        input.orderId ?? null,
        input.expiresAt,
      ],
    );
    return result.rows[0]!;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.databaseService.db.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }
}
