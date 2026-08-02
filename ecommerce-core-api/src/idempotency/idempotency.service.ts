import { ConflictException, Injectable } from '@nestjs/common';
import { CHECKOUT_ERROR_CODES, CheckoutDomainException } from '../checkout/checkout.errors';
import type { QueryExecutor } from '../database/query-executor';
import { DatabaseService } from '../database/database.service';
import { IdempotencyRepository } from './idempotency.repository';

export type IdempotencyClaim =
  | { kind: 'owned'; recordId: string }
  | {
      kind: 'replay';
      recordId: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
    };

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlHours = 24;

  constructor(
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  async claimInTransaction(
    db: QueryExecutor,
    input: {
      storeId: string;
      operation: string;
      key: string;
      actorId: string | null;
      requestHash: string;
    },
  ): Promise<IdempotencyClaim> {
    const inserted = await this.idempotencyRepository.claim(db, {
      ...input,
      expiresAt: this.computeExpiresAt(),
    });
    if (inserted) {
      return { kind: 'owned', recordId: inserted.id };
    }

    const existing = await this.idempotencyRepository.find(
      db,
      input.storeId,
      input.operation,
      input.key,
    );
    if (!existing) {
      throw new ConflictException({
        code: CHECKOUT_ERROR_CODES.IDEMPOTENCY_REQUEST_IN_PROGRESS,
        message: 'The idempotency request could not be resolved',
      });
    }
    if (existing.request_hash !== input.requestHash) {
      throw new CheckoutDomainException(
        CHECKOUT_ERROR_CODES.IDEMPOTENCY_KEY_PAYLOAD_MISMATCH,
        'The Idempotency-Key was already used with a different checkout payload',
      );
    }
    if (
      (existing.status === 'completed' || existing.status === 'failed') &&
      existing.response_status !== null &&
      existing.response_body !== null
    ) {
      return {
        kind: 'replay',
        recordId: existing.id,
        responseStatus: existing.response_status,
        responseBody: existing.response_body,
      };
    }
    throw new CheckoutDomainException(
      CHECKOUT_ERROR_CODES.IDEMPOTENCY_REQUEST_IN_PROGRESS,
      'A checkout with this Idempotency-Key is still processing',
    );
  }

  completeInTransaction(
    db: QueryExecutor,
    input: {
      recordId: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
      orderId: string;
    },
  ): Promise<void> {
    return this.idempotencyRepository.complete(db, input);
  }

  failInTransaction(
    db: QueryExecutor,
    input: {
      recordId: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
      lastError: string;
    },
  ): Promise<void> {
    return this.idempotencyRepository.fail(db, input);
  }

  cleanupExpired(): Promise<number> {
    return this.idempotencyRepository.deleteExpired(this.databaseService.db);
  }

  private computeExpiresAt(): Date {
    const configured = Number(process.env.IDEMPOTENCY_KEY_TTL_HOURS ?? this.defaultTtlHours);
    const ttlHours = Number.isInteger(configured) && configured >= 1 && configured <= 168
      ? configured
      : this.defaultTtlHours;
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }
}
