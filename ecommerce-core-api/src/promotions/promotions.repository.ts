import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { CartItemSnapshot } from '../orders/orders.repository';
import type { DiscountType } from './constants/discount.constants';
import type { OfferTargetType } from './constants/offer.constants';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface CouponRecord {
  id: string;
  store_id: string;
  code: string;
  affiliate_id: string | null;
  is_free_shipping: boolean;
  discount_type: DiscountType;
  discount_value: string;
  min_order_amount: string;
  starts_at: Date | null;
  ends_at: Date | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
}

export interface OfferRecord {
  id: string;
  store_id: string;
  name: string;
  target_type: OfferTargetType;
  target_product_id: string | null;
  target_category_id: string | null;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: Date | null;
  ends_at: Date | null;
  is_active: boolean;
}

export interface InlineProductOfferRecord {
  product_id: string;
  discount_type: DiscountType;
  discount_value: string;
}

@Injectable()
export class PromotionsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createCoupon(input: {
    storeId: string;
    code: string;
    affiliateId: string | null;
    isFreeShipping: boolean;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number;
    startsAt: Date | null;
    endsAt: Date | null;
    maxUses: number | null;
  }): Promise<CouponRecord> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        INSERT INTO coupons (
          id,
          store_id,
          code,
          affiliate_id,
          is_free_shipping,
          discount_type,
          discount_value,
          min_order_amount,
          starts_at,
          ends_at,
          max_uses,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
        RETURNING id, store_id, code, affiliate_id, is_free_shipping, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active
      `,
      [
        uuidv4(),
        input.storeId,
        input.code,
        input.affiliateId,
        input.isFreeShipping,
        input.discountType,
        input.discountValue,
        input.minOrderAmount,
        input.startsAt,
        input.endsAt,
        input.maxUses,
      ],
    );
    return result.rows[0] as CouponRecord;
  }

  async listCoupons(storeId: string, q?: string): Promise<CouponRecord[]> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        SELECT id, store_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active
        , affiliate_id, is_free_shipping
        FROM coupons
        WHERE store_id = $1
          AND ($2::text IS NULL OR code ILIKE '%' || $2 || '%')
        ORDER BY created_at DESC
      `,
      [storeId, q ?? null],
    );
    return result.rows;
  }

  async findCouponById(storeId: string, couponId: string): Promise<CouponRecord | null> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        SELECT id, store_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active
        , affiliate_id, is_free_shipping
        FROM coupons
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, couponId],
    );
    return result.rows[0] ?? null;
  }

  async findCouponByCode(storeId: string, code: string): Promise<CouponRecord | null> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        SELECT id, store_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active
        , affiliate_id, is_free_shipping
        FROM coupons
        WHERE store_id = $1
          AND LOWER(code) = LOWER($2)
        LIMIT 1
      `,
      [storeId, code],
    );
    return result.rows[0] ?? null;
  }

  async updateCoupon(input: {
    storeId: string;
    couponId: string;
    code: string;
    affiliateId: string | null;
    isFreeShipping: boolean;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number;
    startsAt: Date | null;
    endsAt: Date | null;
    maxUses: number | null;
    isActive: boolean;
  }): Promise<CouponRecord | null> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        UPDATE coupons
        SET code = $3,
            affiliate_id = $4,
            is_free_shipping = $5,
            discount_type = $6,
            discount_value = $7,
            min_order_amount = $8,
            starts_at = $9,
            ends_at = $10,
            max_uses = $11,
            is_active = $12,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, code, affiliate_id, is_free_shipping, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active
      `,
      [
        input.storeId,
        input.couponId,
        input.code,
        input.affiliateId,
        input.isFreeShipping,
        input.discountType,
        input.discountValue,
        input.minOrderAmount,
        input.startsAt,
        input.endsAt,
        input.maxUses,
        input.isActive,
      ],
    );
    return result.rows[0] ?? null;
  }

  async incrementCouponUsage(db: Queryable, storeId: string, couponId: string): Promise<boolean> {
    const result = await db.query(
      `
        UPDATE coupons
        SET used_count = used_count + 1,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING id
      `,
      [couponId, storeId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async affiliateExistsForStore(storeId: string, affiliateId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ id: string }>(
      `
        SELECT id
        FROM affiliates
        WHERE store_id = $1
          AND id = $2
          AND status = 'active'
        LIMIT 1
      `,
      [storeId, affiliateId],
    );
    return Boolean(result.rows[0]?.id);
  }

  async createOffer(input: {
    storeId: string;
    name: string;
    targetType: OfferTargetType;
    targetProductId: string | null;
    targetCategoryId: string | null;
    discountType: DiscountType;
    discountValue: number;
    startsAt: Date | null;
    endsAt: Date | null;
  }): Promise<OfferRecord> {
    const result = await this.databaseService.db.query<OfferRecord>(
      `
        INSERT INTO offers (
          id,
          store_id,
          name,
          target_type,
          target_product_id,
          target_category_id,
          discount_type,
          discount_value,
          starts_at,
          ends_at,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
        RETURNING id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.targetType,
        input.targetProductId,
        input.targetCategoryId,
        input.discountType,
        input.discountValue,
        input.startsAt,
        input.endsAt,
      ],
    );
    return result.rows[0] as OfferRecord;
  }

  async listOffers(storeId: string, q?: string): Promise<OfferRecord[]> {
    const result = await this.databaseService.db.query<OfferRecord>(
      `
        SELECT id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
        FROM offers
        WHERE store_id = $1
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
        ORDER BY created_at DESC
      `,
      [storeId, q ?? null],
    );
    return result.rows;
  }

  async findOfferById(storeId: string, offerId: string): Promise<OfferRecord | null> {
    const result = await this.databaseService.db.query<OfferRecord>(
      `
        SELECT id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
        FROM offers
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, offerId],
    );
    return result.rows[0] ?? null;
  }

  async updateOffer(input: {
    storeId: string;
    offerId: string;
    name: string;
    targetType: OfferTargetType;
    targetProductId: string | null;
    targetCategoryId: string | null;
    discountType: DiscountType;
    discountValue: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
  }): Promise<OfferRecord | null> {
    const result = await this.databaseService.db.query<OfferRecord>(
      `
        UPDATE offers
        SET name = $3,
            target_type = $4,
            target_product_id = $5,
            target_category_id = $6,
            discount_type = $7,
            discount_value = $8,
            starts_at = $9,
            ends_at = $10,
            is_active = $11,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
      `,
      [
        input.storeId,
        input.offerId,
        input.name,
        input.targetType,
        input.targetProductId,
        input.targetCategoryId,
        input.discountType,
        input.discountValue,
        input.startsAt,
        input.endsAt,
        input.isActive,
      ],
    );
    return result.rows[0] ?? null;
  }

  async listActiveOffers(storeId: string, now: Date): Promise<OfferRecord[]> {
    const result = await this.databaseService.db.query<OfferRecord>(
      `
        SELECT id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
        FROM offers
        WHERE store_id = $1
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= $2)
          AND (ends_at IS NULL OR ends_at >= $2)
      `,
      [storeId, now],
    );
    return result.rows;
  }

  async listActiveInlineProductOffers(
    storeId: string,
    productIds: string[],
    now: Date,
  ): Promise<InlineProductOfferRecord[]> {
    if (productIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<InlineProductOfferRecord>(
      `
        SELECT
          id AS product_id,
          inline_discount_type AS discount_type,
          inline_discount_value AS discount_value
        FROM products
        WHERE store_id = $1
          AND id = ANY($2::uuid[])
          AND inline_discount_active = TRUE
          AND inline_discount_type IS NOT NULL
          AND inline_discount_value IS NOT NULL
          AND (inline_discount_starts_at IS NULL OR inline_discount_starts_at <= $3)
          AND (inline_discount_ends_at IS NULL OR inline_discount_ends_at >= $3)
      `,
      [storeId, productIds, now],
    );

    return result.rows;
  }

  calculateBestOfferDiscount(
    offers: OfferRecord[],
    subtotal: number,
    items: CartItemSnapshot[],
  ): { offerId: string | null; discount: number } {
    let best = { offerId: null as string | null, discount: 0 };

    for (const offer of offers) {
      const eligibleSubtotal = this.resolveEligibleSubtotal(offer, subtotal, items);
      if (eligibleSubtotal <= 0) {
        continue;
      }

      const discount = this.calculateDiscount(
        Number(offer.discount_value),
        offer.discount_type,
        eligibleSubtotal,
      );

      if (discount > best.discount) {
        best = { offerId: offer.id, discount };
      }
    }

    return best;
  }

  private resolveEligibleSubtotal(
    offer: OfferRecord,
    subtotal: number,
    items: CartItemSnapshot[],
  ): number {
    if (offer.target_type === 'cart') {
      return subtotal;
    }

    if (offer.target_type === 'product') {
      return items
        .filter((item) => item.product_id === offer.target_product_id)
        .reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
    }

    return items
      .filter((item) => item.category_id === offer.target_category_id)
      .reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  }

  calculateDiscount(value: number, type: DiscountType, baseAmount: number): number {
    if (type === 'percent') {
      return Number(Math.min(baseAmount, (baseAmount * value) / 100).toFixed(2));
    }
    return Number(Math.min(value, baseAmount).toFixed(2));
  }
}
