import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { StorefrontEventType } from './constants/storefront-event.constants';

interface SessionAttributionRecord {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
}

@Injectable()
export class StorefrontTrackingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insertEvent(input: {
    storeId: string;
    eventType: StorefrontEventType;
    sessionId: string;
    customerId?: string | null;
    cartId?: string | null;
    orderId?: string | null;
    productId?: string | null;
    variantId?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    referrer?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO storefront_events (
          id,
          store_id,
          event_type,
          session_id,
          customer_id,
          cart_id,
          order_id,
          product_id,
          variant_id,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_term,
          utm_content,
          referrer,
          metadata,
          occurred_at
        )
        VALUES (
          $1, $2, $3, $4, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::uuid,
          $10, $11, $12, $13, $14, $15, $16::jsonb, NOW()
        )
      `,
      [
        uuidv4(),
        input.storeId,
        input.eventType,
        input.sessionId,
        input.customerId ?? null,
        input.cartId ?? null,
        input.orderId ?? null,
        input.productId ?? null,
        input.variantId ?? null,
        input.utmSource ?? null,
        input.utmMedium ?? null,
        input.utmCampaign ?? null,
        input.utmTerm ?? null,
        input.utmContent ?? null,
        input.referrer ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  async findLatestSessionAttribution(
    storeId: string,
    sessionId: string,
  ): Promise<SessionAttributionRecord | null> {
    const result = await this.databaseService.db.query<SessionAttributionRecord>(
      `
        SELECT utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer
        FROM storefront_events
        WHERE store_id = $1
          AND session_id = $2
          AND (
            utm_source IS NOT NULL
            OR utm_medium IS NOT NULL
            OR utm_campaign IS NOT NULL
            OR utm_term IS NOT NULL
            OR utm_content IS NOT NULL
            OR referrer IS NOT NULL
          )
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [storeId, sessionId],
    );

    return result.rows[0] ?? null;
  }
}
