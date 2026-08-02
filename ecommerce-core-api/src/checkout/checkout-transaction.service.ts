import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { MetricsService } from '../observability/metrics.service';
import { normalizeCheckoutError } from './checkout.errors';
import type { AtomicCheckoutContext, AtomicCheckoutResult } from './checkout.types';

@Injectable()
export class CheckoutTransactionService {
  private readonly logger = new Logger(CheckoutTransactionService.name);
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly idempotencyService: IdempotencyService,
    private readonly metricsService: MetricsService,
  ) {}

  async execute<T extends Record<string, unknown>>(input: {
    storeId: string;
    actorId: string | null;
    operation: string;
    idempotencyKey: string;
    requestHash: string;
    work: (context: AtomicCheckoutContext) => Promise<AtomicCheckoutResult<T>>;
  }): Promise<{ status: number; body: T | { code: string; message: string }; replayed: boolean }> {
    const client = await this.databaseService.db.connect();
    let committedFailure: { status: number; body: { code: string; message: string } } | null = null;
    try {
      await client.query('BEGIN');
      const claim = await this.idempotencyService.claimInTransaction(client, {
        storeId: input.storeId,
        actorId: input.actorId,
        operation: input.operation,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
      });

      if (claim.kind === 'replay') {
        await client.query('COMMIT');
        this.metricsService.incrementCounter('checkout_idempotency_replay_total', {
          store_id: input.storeId,
          operation: input.operation,
        });
        return {
          status: claim.responseStatus,
          body: claim.responseBody as T | { code: string; message: string },
          replayed: true,
        };
      }

      await client.query('SAVEPOINT checkout_business');
      try {
        const result = await input.work({
          db: client,
          idempotencyRecordId: claim.recordId,
        });
        await this.idempotencyService.completeInTransaction(client, {
          recordId: claim.recordId,
          responseStatus: result.status,
          responseBody: result.body,
          orderId: result.orderId,
        });
        await client.query('RELEASE SAVEPOINT checkout_business');
        await client.query('COMMIT');
        this.metricsService.incrementCounter('checkout_success_total', {
          store_id: input.storeId,
        });
        return { status: result.status, body: result.body, replayed: false };
      } catch (error) {
        this.logger.error({
          message: 'Checkout business transaction failed',
          storeId: input.storeId,
          operation: input.operation,
          idempotencyRecordId: claim.recordId,
          error: error instanceof Error ? error.message : 'Unknown checkout failure',
        });
        const normalized = normalizeCheckoutError(error);
        await client.query('ROLLBACK TO SAVEPOINT checkout_business');
        await this.idempotencyService.failInTransaction(client, {
          recordId: claim.recordId,
          responseStatus: normalized.status,
          responseBody: normalized.body,
          lastError: normalized.body.code,
        });
        await client.query('RELEASE SAVEPOINT checkout_business');
        await client.query('COMMIT');
        committedFailure = normalized;
      }
    } catch (error) {
      await this.rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }

    if (!committedFailure) {
      throw new Error('Checkout transaction ended without a result');
    }
    this.metricsService.incrementCounter('checkout_failure_total', {
      store_id: input.storeId,
      reason: committedFailure.body.code,
    });
    return { status: committedFailure.status, body: committedFailure.body, replayed: false };
  }

  private async rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The original connection/transaction error remains authoritative.
    }
  }
}
