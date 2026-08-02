import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { QueryExecutor } from '../database/query-executor';
import { IdempotencyService, type IdempotencyClaim } from '../idempotency/idempotency.service';

@Injectable()
export class CommercialCommandIdempotencyService {
  constructor(private readonly idempotency: IdempotencyService) {}

  claim(
    db: QueryExecutor,
    input: {
      storeId: string;
      operation: string;
      key: string;
      actorId: string | null;
      payload: unknown;
    },
  ): Promise<IdempotencyClaim> {
    return this.idempotency.claimInTransaction(db, {
      storeId: input.storeId,
      operation: input.operation,
      key: input.key,
      actorId: input.actorId,
      requestHash: createHash('sha256')
        .update(this.stableStringify(input.payload))
        .digest('hex'),
    });
  }

  complete(
    db: QueryExecutor,
    input: {
      recordId: string;
      orderId: string;
      responseBody: Record<string, unknown>;
      responseStatus?: number;
    },
  ): Promise<void> {
    return this.idempotency.completeInTransaction(db, {
      ...input,
      responseStatus: input.responseStatus ?? 200,
    });
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) =>
        `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }
}

