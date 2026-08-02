import type { QueryExecutor } from '../database/query-executor';

export interface AtomicCheckoutContext {
  db: QueryExecutor;
  idempotencyRecordId: string;
}

export interface AtomicCheckoutResult<T extends Record<string, unknown>> {
  status: number;
  body: T;
  orderId: string;
}

