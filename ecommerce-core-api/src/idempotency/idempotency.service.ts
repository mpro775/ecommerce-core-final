import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IdempotencyRepository, type IdempotencyKeyRecord } from './idempotency.repository';

export interface IdempotencyContext {
  storeId: string;
  key: string;
  requestBody: unknown;
}

export interface IdempotencyResult {
  isCached: boolean;
  record: IdempotencyKeyRecord | null;
}

@Injectable()
export class IdempotencyService {
  private readonly defaultTtlHours = 24;

  constructor(private readonly idempotencyRepository: IdempotencyRepository) {}

  async checkOrPrepare(context: IdempotencyContext): Promise<IdempotencyResult> {
    if (!context.key) {
      return { isCached: false, record: null };
    }

    const existing = await this.idempotencyRepository.findByStoreAndKey(
      context.storeId,
      context.key,
    );

    if (existing && !this.isExpired(existing)) {
      return { isCached: true, record: existing };
    }

    return { isCached: false, record: null };
  }

  async storeResponse(
    storeId: string,
    key: string,
    requestBody: unknown,
    response: Record<string, unknown>,
    orderId?: string,
  ): Promise<void> {
    if (!key) {
      return;
    }

    const requestHash = this.computeRequestHash(requestBody);
    const expiresAt = this.computeExpiresAt();

    const createInput: {
      storeId: string;
      key: string;
      requestHash: string;
      response: Record<string, unknown>;
      orderId?: string;
      expiresAt: Date;
    } = {
      storeId,
      key,
      requestHash,
      response,
      expiresAt,
    };
    if (orderId) {
      createInput.orderId = orderId;
    }
    await this.idempotencyRepository.create(createInput);
  }

  async cleanupExpired(): Promise<number> {
    return this.idempotencyRepository.deleteExpired();
  }

  private computeRequestHash(body: unknown): string {
    const normalized = JSON.stringify(body, Object.keys(body as Record<string, unknown>).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  private computeExpiresAt(): Date {
    const ttlHours = this.getTtlHours();
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private getTtlHours(): number {
    const raw = Number(process.env.IDEMPOTENCY_KEY_TTL_HOURS ?? this.defaultTtlHours);
    if (!Number.isInteger(raw) || raw < 1 || raw > 168) {
      return this.defaultTtlHours;
    }
    return raw;
  }

  private isExpired(record: IdempotencyKeyRecord): boolean {
    return new Date() > record.expires_at;
  }
}
