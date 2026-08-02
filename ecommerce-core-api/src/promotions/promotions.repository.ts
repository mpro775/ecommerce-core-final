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
  per_customer_limit: number | null;
  maximum_discount: string | null;
  currency_code: string | null;
  included_product_ids: string[];
  excluded_product_ids: string[];
  included_category_ids: string[];
  excluded_category_ids: string[];
  updated_at: Date;
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
    perCustomerLimit: number | null;
    maximumDiscount: number | null;
    currencyCode: string | null;
    includedProductIds: string[];
    excludedProductIds: string[];
    includedCategoryIds: string[];
    excludedCategoryIds: string[];
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
          is_active, per_customer_limit, maximum_discount, currency_code,
          included_product_ids, excluded_product_ids,
          included_category_ids, excluded_category_ids
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE,
                  $12, $13, $14, $15, $16, $17, $18)
        RETURNING id, store_id, code, affiliate_id, is_free_shipping, discount_type,
          discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count,
          is_active, per_customer_limit, maximum_discount, currency_code,
          included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids
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
        input.perCustomerLimit,
        input.maximumDiscount,
        input.currencyCode,
        input.includedProductIds,
        input.excludedProductIds,
        input.includedCategoryIds,
        input.excludedCategoryIds,
      ],
    );
    return result.rows[0] as CouponRecord;
  }

  async listCoupons(storeId: string, q?: string): Promise<CouponRecord[]> {
    const result = await this.databaseService.db.query<CouponRecord>(
      `
        SELECT id, store_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active,
               affiliate_id, is_free_shipping, per_customer_limit, maximum_discount, currency_code,
               included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids
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
        , affiliate_id, is_free_shipping, per_customer_limit, maximum_discount, currency_code,
          included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids
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
        SELECT id, store_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count, is_active,
               affiliate_id, is_free_shipping, per_customer_limit, maximum_discount, currency_code,
               included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids
        FROM coupons
        WHERE store_id = $1
          AND LOWER(code) = LOWER($2)
        LIMIT 1
      `,
      [storeId, code],
    );
    return result.rows[0] ?? null;
  }

  async findCouponByCodeForCheckout(
    db: Queryable,
    storeId: string,
    code: string,
  ): Promise<CouponRecord | null> {
    const result = await db.query<CouponRecord>(
      `SELECT id, store_id, code, discount_type, discount_value, min_order_amount,
              starts_at, ends_at, max_uses, used_count, is_active, affiliate_id,
              is_free_shipping, per_customer_limit, maximum_discount, currency_code,
              included_product_ids, excluded_product_ids,
              included_category_ids, excluded_category_ids
       FROM coupons
       WHERE store_id = $1 AND LOWER(code) = LOWER($2)
       FOR UPDATE`,
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
    perCustomerLimit: number | null;
    maximumDiscount: number | null;
    currencyCode: string | null;
    includedProductIds: string[];
    excludedProductIds: string[];
    includedCategoryIds: string[];
    excludedCategoryIds: string[];
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
            per_customer_limit = $13,
            maximum_discount = $14,
            currency_code = $15,
            included_product_ids = $16,
            excluded_product_ids = $17,
            included_category_ids = $18,
            excluded_category_ids = $19,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, code, affiliate_id, is_free_shipping, discount_type,
          discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count,
          is_active, per_customer_limit, maximum_discount, currency_code,
          included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids
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
        input.perCustomerLimit,
        input.maximumDiscount,
        input.currencyCode,
        input.includedProductIds,
        input.excludedProductIds,
        input.includedCategoryIds,
        input.excludedCategoryIds,
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

  async consumeCoupon(
    db: Queryable,
    input: {
      storeId: string;
      couponId: string;
      orderId: string;
      customerId: string | null;
      discountAmount: number;
      currencyCode: string;
      productIds: string[];
      categoryIds: string[];
      subtotal: number;
    },
  ): Promise<{ id: string; code: string; created: boolean }> {
    const locked = await db.query<CouponRecord>(
      `SELECT id, store_id, code, affiliate_id, is_free_shipping, discount_type,
              discount_value, min_order_amount, starts_at, ends_at, max_uses, used_count,
              is_active, per_customer_limit, maximum_discount, currency_code,
              included_product_ids, excluded_product_ids,
              included_category_ids, excluded_category_ids
       FROM coupons
       WHERE store_id = $1 AND id = $2
       FOR UPDATE`,
      [input.storeId, input.couponId],
    );
    const coupon = locked.rows[0];
    if (!coupon) throw new Error('COUPON_INVALID');

    const replay = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM coupon_usages
       WHERE store_id = $1 AND coupon_id = $2 AND order_id = $3
       LIMIT 1`,
      [input.storeId, input.couponId, input.orderId],
    );
    if (replay.rows[0]?.status === 'consumed') {
      return { id: replay.rows[0].id, code: coupon.code, created: false };
    }
    const now = Date.now();
    if (!coupon.is_active) throw new Error('COUPON_INVALID');
    if (coupon.starts_at && coupon.starts_at.getTime() > now) throw new Error('COUPON_INVALID');
    if (coupon.ends_at && coupon.ends_at.getTime() <= now) throw new Error('COUPON_EXPIRED');
    if (input.subtotal < Number(coupon.min_order_amount)) throw new Error('COUPON_INVALID');
    if (coupon.currency_code && coupon.currency_code !== input.currencyCode) throw new Error('COUPON_INVALID');
    if (coupon.maximum_discount !== null && input.discountAmount > Number(coupon.maximum_discount)) {
      throw new Error('COUPON_INVALID');
    }
    const products = new Set(input.productIds);
    const categories = new Set(input.categoryIds);
    if (coupon.included_product_ids.length > 0 && !coupon.included_product_ids.some((id) => products.has(id))) throw new Error('COUPON_INVALID');
    if (coupon.excluded_product_ids.some((id) => products.has(id))) throw new Error('COUPON_INVALID');
    if (coupon.included_category_ids.length > 0 && !coupon.included_category_ids.some((id) => categories.has(id))) throw new Error('COUPON_INVALID');
    if (coupon.excluded_category_ids.some((id) => categories.has(id))) throw new Error('COUPON_INVALID');

    const usageId = replay.rows[0]?.id ?? uuidv4();
    const inserted = replay.rows[0]
      ? await db.query<{ id: string }>(
          `UPDATE coupon_usages
           SET customer_id = $4, coupon_code_snapshot = $5, discount_amount = $6,
               currency_code = $7, status = 'consumed', reversed_at = NULL,
               reversal_reason = NULL
           WHERE id = $1 AND store_id = $2 AND coupon_id = $3 AND status = 'reversed'
           RETURNING id`,
          [usageId, input.storeId, coupon.id, input.customerId, coupon.code,
           input.discountAmount, input.currencyCode],
        )
      : await db.query<{ id: string }>(
        `INSERT INTO coupon_usages (
         id, store_id, coupon_id, order_id, customer_id, coupon_code_snapshot,
         discount_amount, currency_code, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'consumed')
       ON CONFLICT (store_id, coupon_id, order_id) DO NOTHING
       RETURNING id`,
      [usageId, input.storeId, coupon.id, input.orderId, input.customerId, coupon.code,
       input.discountAmount, input.currencyCode]);
    if (!inserted.rows[0]) {
      const existing = await db.query<{ id: string }>(
        `SELECT id FROM coupon_usages
         WHERE store_id = $1 AND coupon_id = $2 AND order_id = $3
         LIMIT 1`,
        [input.storeId, coupon.id, input.orderId],
      );
      if (!existing.rows[0]) throw new Error('COUPON_INVALID');
      return { id: existing.rows[0].id, code: coupon.code, created: false };
    }

    const incremented = await db.query(
      `UPDATE coupons
       SET used_count = used_count + 1, updated_at = NOW()
       WHERE id = $1 AND store_id = $2 AND is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [coupon.id, input.storeId],
    );
    if ((incremented.rowCount ?? 0) !== 1) throw new Error('COUPON_USAGE_LIMIT_REACHED');

    if (coupon.per_customer_limit !== null) {
      if (!input.customerId) throw new Error('COUPON_CUSTOMER_LIMIT_REACHED');
      const counter = await db.query(
        `INSERT INTO coupon_customer_counters (store_id, coupon_id, customer_id, consumed_count)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (store_id, coupon_id, customer_id)
         DO UPDATE SET consumed_count = coupon_customer_counters.consumed_count + 1,
                       updated_at = NOW()
         WHERE coupon_customer_counters.consumed_count < $4`,
        [input.storeId, coupon.id, input.customerId, coupon.per_customer_limit],
      );
      if ((counter.rowCount ?? 0) !== 1) throw new Error('COUPON_CUSTOMER_LIMIT_REACHED');
    }

    return { id: usageId, code: coupon.code, created: true };
  }

  async reverseCouponUsage(
    db: Queryable,
    input: { storeId: string; orderId: string; reason: string },
  ): Promise<{ usageId: string; couponId: string } | null> {
    const reversed = await db.query<{ id: string; coupon_id: string; customer_id: string | null }>(
      `UPDATE coupon_usages
       SET status = 'reversed', reversed_at = NOW(), reversal_reason = $3
       WHERE store_id = $1 AND order_id = $2 AND status = 'consumed'
       RETURNING id, coupon_id, customer_id`,
      [input.storeId, input.orderId, input.reason],
    );
    const row = reversed.rows[0];
    if (!row) return null;
    await db.query(
      `UPDATE coupons SET used_count = GREATEST(used_count - 1, 0), updated_at = NOW()
       WHERE store_id = $1 AND id = $2`,
      [input.storeId, row.coupon_id],
    );
    if (row.customer_id) {
      await db.query(
        `UPDATE coupon_customer_counters
         SET consumed_count = consumed_count - 1, updated_at = NOW()
         WHERE store_id = $1 AND coupon_id = $2 AND customer_id = $3 AND consumed_count > 0`,
        [input.storeId, row.coupon_id, row.customer_id],
      );
    }
    return { usageId: row.id, couponId: row.coupon_id };
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

  async listActiveOffers(storeId: string, now: Date, db?: Queryable): Promise<OfferRecord[]> {
    const result = await (db ?? this.databaseService.db).query<OfferRecord>(
      `
        SELECT id, store_id, name, target_type, target_product_id, target_category_id, discount_type, discount_value, starts_at, ends_at, is_active
        FROM offers
        WHERE store_id = $1
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= $2)
          AND (ends_at IS NULL OR ends_at >= $2)
        ${db ? 'FOR SHARE' : ''}
      `,
      [storeId, now],
    );
    return result.rows;
  }

  async listActiveInlineProductOffers(
    storeId: string,
    productIds: string[],
    now: Date,
    db?: Queryable,
  ): Promise<InlineProductOfferRecord[]> {
    if (productIds.length === 0) {
      return [];
    }

    const result = await (db ?? this.databaseService.db).query<InlineProductOfferRecord>(
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
        ${db ? 'FOR SHARE' : ''}
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
