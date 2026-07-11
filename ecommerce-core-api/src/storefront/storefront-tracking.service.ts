import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import type { StorefrontEventType } from './constants/storefront-event.constants';
import { DatabaseService } from '../database/database.service';
import { StorefrontTrackingRepository } from './storefront-tracking.repository';
import { AffiliatesService } from '../affiliates/affiliates.service';

@Injectable()
export class StorefrontTrackingService {
  private readonly maxEventsPerMinute = 120;

  constructor(
    private readonly trackingRepository: StorefrontTrackingRepository,
    private readonly databaseService: DatabaseService,
    private readonly affiliatesService: AffiliatesService,
  ) {}

  async trackEvent(
    request: Request,
    input: {
      storeId: string;
      eventType: StorefrontEventType;
      customerId?: string | null;
      cartId?: string | null;
      orderId?: string | null;
      productId?: string | null;
      variantId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const sessionId = this.resolveSessionId(request);
    await this.affiliatesService.trackAffiliateClickFromRequest(request, {
      storeId: input.storeId,
      sessionId,
    });
    const canTrack = await this.shouldTrackEvent(input.storeId, sessionId);
    if (!canTrack) {
      return;
    }

    const directAttribution = this.extractAttribution(request);
    const fallbackAttribution =
      directAttribution.utmSource ||
      directAttribution.utmMedium ||
      directAttribution.utmCampaign ||
      directAttribution.utmTerm ||
      directAttribution.utmContent ||
      directAttribution.referrer
        ? null
        : await this.trackingRepository.findLatestSessionAttribution(input.storeId, sessionId);

    await this.trackingRepository.insertEvent({
      storeId: input.storeId,
      eventType: input.eventType,
      sessionId,
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.cartId !== undefined ? { cartId: input.cartId } : {}),
      ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
      utmSource: directAttribution.utmSource ?? fallbackAttribution?.utm_source ?? null,
      utmMedium: directAttribution.utmMedium ?? fallbackAttribution?.utm_medium ?? null,
      utmCampaign: directAttribution.utmCampaign ?? fallbackAttribution?.utm_campaign ?? null,
      utmTerm: directAttribution.utmTerm ?? fallbackAttribution?.utm_term ?? null,
      utmContent: directAttribution.utmContent ?? fallbackAttribution?.utm_content ?? null,
      referrer: directAttribution.referrer ?? fallbackAttribution?.referrer ?? null,
      ...(input.metadata !== undefined ? { metadata: this.sanitizeMetadata(input.metadata) } : {}),
    });
  }

  private async shouldTrackEvent(storeId: string, sessionId: string): Promise<boolean> {
    const key = `sf:events:rate:${storeId}:${sessionId}`;

    try {
      await this.databaseService.pingRedis();
      const nextCount = await this.databaseService.cache.incr(key);
      if (nextCount === 1) {
        await this.databaseService.cache.expire(key, 60);
      }

      return nextCount <= this.maxEventsPerMinute;
    } catch {
      return true;
    }
  }

  private sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(input).slice(0, 30);
    const output: Record<string, unknown> = {};

    for (const [key, value] of entries) {
      const safeKey = key.trim().slice(0, 80);
      if (!safeKey) {
        continue;
      }

      const normalized = this.normalizeMetadataValue(value, 0);
      if (normalized !== undefined) {
        output[safeKey] = normalized;
      }
    }

    return output;
  }

  private normalizeMetadataValue(value: unknown, depth: number): unknown {
    if (depth > 3) {
      return undefined;
    }

    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return value.trim().slice(0, 300);
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 12)
        .map((item) => this.normalizeMetadataValue(item, depth + 1))
        .filter((item) => item !== undefined);
    }

    if (typeof value === 'object' && value !== null) {
      const objectEntries = Object.entries(value as Record<string, unknown>).slice(0, 20);
      const output: Record<string, unknown> = {};
      for (const [key, item] of objectEntries) {
        const safeKey = key.trim().slice(0, 80);
        if (!safeKey) {
          continue;
        }

        const normalized = this.normalizeMetadataValue(item, depth + 1);
        if (normalized !== undefined) {
          output[safeKey] = normalized;
        }
      }

      return output;
    }

    return undefined;
  }

  private resolveSessionId(request: Request): string {
    const fromHeader = this.readStringHeader(request, 'x-storefront-session-id');
    if (fromHeader) {
      return fromHeader;
    }

    const fromCookie = this.readCookieValue(request, 'sf_session_id');
    if (fromCookie) {
      return fromCookie;
    }

    const fromQuery = this.readStringQuery(request, 'sid');
    if (fromQuery) {
      return fromQuery;
    }

    const ip = request.ip ?? 'unknown-ip';
    const userAgent = this.readStringHeader(request, 'user-agent') ?? 'unknown-ua';
    return `anon-${createHash('sha1').update(`${ip}|${userAgent}`).digest('hex').slice(0, 24)}`;
  }

  resolveSessionIdForRequest(request: Request): string {
    return this.resolveSessionId(request);
  }

  private extractAttribution(request: Request): {
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    referrer: string | null;
  } {
    return {
      utmSource: this.readStringQuery(request, 'utm_source'),
      utmMedium: this.readStringQuery(request, 'utm_medium'),
      utmCampaign: this.readStringQuery(request, 'utm_campaign'),
      utmTerm: this.readStringQuery(request, 'utm_term'),
      utmContent: this.readStringQuery(request, 'utm_content'),
      referrer:
        this.readStringHeader(request, 'referer') ?? this.readStringHeader(request, 'referrer'),
    };
  }

  private readStringHeader(request: Request, key: string): string | null {
    const value = request.headers[key];
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'string' && first.trim().length > 0
        ? first.trim().slice(0, 500)
        : null;
    }
    return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 500) : null;
  }

  private readCookieValue(request: Request, key: string): string | null {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 200) : null;
  }

  private readStringQuery(request: Request, key: string): string | null {
    const value = request.query[key];
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim().slice(0, 200)
      : null;
  }
}
