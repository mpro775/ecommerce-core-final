import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { CartItemSnapshot } from '../orders/orders.repository';
import { MetricsService } from '../observability/metrics.service';
import { AdvancedOffersService } from '../advanced-offers/advanced-offers.service';
import { DISCOUNT_TYPES, type DiscountType } from './constants/discount.constants';
import { OFFER_TARGET_TYPES, type OfferTargetType } from './constants/offer.constants';
import type { ApplyCouponDto } from './dto/apply-coupon.dto';
import type { CreateCouponDto } from './dto/create-coupon.dto';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { ListPromotionsQueryDto } from './dto/list-promotions-query.dto';
import type { UpdateCouponDto } from './dto/update-coupon.dto';
import type { UpdateOfferDto } from './dto/update-offer.dto';
import { PromotionsRepository, type CouponRecord, type OfferRecord } from './promotions.repository';
import { CHECKOUT_ERROR_CODES, CheckoutDomainException } from '../checkout/checkout.errors';
import { OutboxService } from '../messaging/outbox.service';
import { allocateLargestRemainder } from '../commercial/money-allocation';

export interface CouponResponse {
  id: string;
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
  usedCount: number;
  isActive: boolean;
  perCustomerLimit: number | null;
  maximumDiscount: number | null;
  currencyCode: string | null;
  includedProductIds: string[];
  excludedProductIds: string[];
  includedCategoryIds: string[];
  excludedCategoryIds: string[];
}

export interface OfferResponse {
  id: string;
  storeId: string;
  name: string;
  targetType: OfferTargetType;
  targetProductId: string | null;
  targetCategoryId: string | null;
  discountType: DiscountType;
  discountValue: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CouponApplyResult {
  couponId: string;
  code: string;
  discount: number;
  subtotal: number;
  isFreeShipping: boolean;
}

export interface PromotionComputationInput {
  subtotal: number;
  couponCode?: string;
  items: CartItemSnapshot[];
  at: Date;
}

export interface PromotionComputationResult {
  couponId: string | null;
  couponCode: string | null;
  couponIsFreeShipping: boolean;
  couponDiscount: number;
  offerId: string | null;
  offerDiscount: number;
  totalDiscount: number;
  offerEligibleLineIds: string[];
  couponEligibleLineIds: string[];
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly promotionsRepository: PromotionsRepository,
    private readonly auditService: AuditService,
    private readonly advancedOffersService: AdvancedOffersService,
    private readonly outboxService: OutboxService,
    private readonly metricsService: MetricsService,
  ) {}

  async createCoupon(
    currentUser: AuthUser,
    input: CreateCouponDto,
    context: RequestContextData,
  ): Promise<CouponResponse> {
    this.validateDiscountType(input.discountType);
    this.validateDiscountValue(input.discountType, input.discountValue);
    this.validateDateWindow(input.startsAt, input.endsAt);
    await this.assertValidAffiliateId(currentUser.storeId, input.affiliateId ?? null);

    const exists = await this.promotionsRepository.findCouponByCode(
      currentUser.storeId,
      input.code,
    );
    if (exists) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.promotionsRepository.createCoupon({
      storeId: currentUser.storeId,
      code: input.code,
      affiliateId: input.affiliateId ?? null,
      isFreeShipping: input.isFreeShipping ?? false,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderAmount: input.minOrderAmount ?? 0,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      maxUses: input.maxUses ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      maximumDiscount: input.maximumDiscount ?? null,
      currencyCode: input.currencyCode?.trim().toUpperCase() ?? null,
      includedProductIds: input.includedProductIds ?? [],
      excludedProductIds: input.excludedProductIds ?? [],
      includedCategoryIds: input.includedCategoryIds ?? [],
      excludedCategoryIds: input.excludedCategoryIds ?? [],
    });

    await this.log('promotions.coupon_created', currentUser, coupon.id, context);
    return this.mapCoupon(coupon);
  }

  async listCoupons(
    currentUser: AuthUser,
    query: ListPromotionsQueryDto,
  ): Promise<CouponResponse[]> {
    const rows = await this.promotionsRepository.listCoupons(currentUser.storeId, query.q?.trim());
    return rows.map((row) => this.mapCoupon(row));
  }

  async updateCoupon(
    currentUser: AuthUser,
    couponId: string,
    input: UpdateCouponDto,
    context: RequestContextData,
  ): Promise<CouponResponse> {
    const existing = await this.promotionsRepository.findCouponById(currentUser.storeId, couponId);
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    const payload = await this.buildCouponUpdatePayload(
      currentUser.storeId,
      couponId,
      input,
      existing,
    );

    const updated = await this.promotionsRepository.updateCoupon({
      storeId: currentUser.storeId,
      couponId,
      ...payload,
    });

    if (!updated) {
      throw new NotFoundException('Coupon not found');
    }

    await this.log('promotions.coupon_updated', currentUser, couponId, context);
    await this.outboxService.enqueueStandalone({
      aggregateType: 'coupon',
      aggregateId: updated.id,
      eventType: 'coupon.updated',
      deduplicationKey: `coupon.updated:${updated.id}:${updated.updated_at.toISOString()}`,
      payload: {
        storeId: currentUser.storeId,
        couponId: updated.id,
        code: updated.code,
        isActive: updated.is_active,
        discountType: updated.discount_type,
        discountValue: Number(updated.discount_value),
      },
    });
    return this.mapCoupon(updated);
  }

  async applyCoupon(currentUser: AuthUser, input: ApplyCouponDto): Promise<CouponApplyResult> {
    const coupon = await this.requireCouponByCode(currentUser.storeId, input.code);
    const now = new Date();
    this.assertCouponUsable(coupon, input.subtotal, now);

    const discount = this.promotionsRepository.calculateDiscount(
      Number(coupon.discount_value),
      coupon.discount_type,
      input.subtotal,
    );

    return {
      couponId: coupon.id,
      code: coupon.code,
      discount,
      subtotal: input.subtotal,
      isFreeShipping: coupon.is_free_shipping,
    };
  }

  async createOffer(
    currentUser: AuthUser,
    input: CreateOfferDto,
    context: RequestContextData,
  ): Promise<OfferResponse> {
    this.validateDiscountType(input.discountType);
    this.validateDiscountValue(input.discountType, input.discountValue);
    this.validateOfferTargets(input.targetType, input.targetProductId, input.targetCategoryId);
    this.validateDateWindow(input.startsAt, input.endsAt);

    const offer = await this.promotionsRepository.createOffer({
      storeId: currentUser.storeId,
      name: input.name.trim(),
      targetType: input.targetType,
      targetProductId: input.targetProductId ?? null,
      targetCategoryId: input.targetCategoryId ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    });

    await this.log('promotions.offer_created', currentUser, offer.id, context);
    return this.mapOffer(offer);
  }

  async listOffers(currentUser: AuthUser, query: ListPromotionsQueryDto): Promise<OfferResponse[]> {
    const rows = await this.promotionsRepository.listOffers(currentUser.storeId, query.q?.trim());
    return rows.map((row) => this.mapOffer(row));
  }

  async updateOffer(
    currentUser: AuthUser,
    offerId: string,
    input: UpdateOfferDto,
    context: RequestContextData,
  ): Promise<OfferResponse> {
    const existing = await this.promotionsRepository.findOfferById(currentUser.storeId, offerId);
    if (!existing) {
      throw new NotFoundException('Offer not found');
    }

    const payload = this.buildOfferUpdatePayload(input, existing);

    const updated = await this.promotionsRepository.updateOffer({
      storeId: currentUser.storeId,
      offerId,
      ...payload,
    });

    if (!updated) {
      throw new NotFoundException('Offer not found');
    }

    await this.log('promotions.offer_updated', currentUser, offerId, context);
    return this.mapOffer(updated);
  }

  async computeManualOrderCouponDiscount(
    storeId: string,
    couponCode: string,
    lines: Array<{
      variantId: string;
      productId: string;
      categoryId: string | null;
      unitPrice: number;
      quantity: number;
      lineDiscount: number;
    }>,
    at: Date,
    db?: Parameters<PromotionsRepository['findCouponByCodeForCheckout']>[0],
  ): Promise<{
    couponId: string | null;
    couponCode: string | null;
    couponDiscount: number;
    couponIsFreeShipping: boolean;
    couponEligibleVariantIds: string[];
  }> {
    const normalizedCode = couponCode.trim().toUpperCase();
    const coupon = db
      ? await this.promotionsRepository.findCouponByCodeForCheckout(db, storeId, normalizedCode)
      : await this.promotionsRepository.findCouponByCode(storeId, normalizedCode);

    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }

    const couponEligibleItems = lines.filter((line) => {
      if (coupon.excluded_product_ids.includes(line.productId)) return false;
      if (line.categoryId && coupon.excluded_category_ids.includes(line.categoryId)) return false;
      if (coupon.included_product_ids.length > 0 && !coupon.included_product_ids.includes(line.productId)) {
        return false;
      }
      if (coupon.included_category_ids.length > 0 &&
          (!line.categoryId || !coupon.included_category_ids.includes(line.categoryId))) {
        return false;
      }
      return true;
    });

    const couponEligibleVariantIds = couponEligibleItems.map((line) => line.variantId);
    const couponBase = Number(couponEligibleItems.reduce(
      (sum, line) => sum + Math.max(0, line.unitPrice * line.quantity - line.lineDiscount),
      0,
    ).toFixed(2));

    this.assertCouponUsable(coupon, couponBase, at);
    
    let couponDiscount = this.promotionsRepository.calculateDiscount(
      Number(coupon.discount_value),
      coupon.discount_type,
      couponBase,
    );
    if (coupon.maximum_discount !== null) {
      couponDiscount = Math.min(couponDiscount, Number(coupon.maximum_discount));
    }

    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      couponDiscount,
      couponIsFreeShipping: coupon.is_free_shipping,
      couponEligibleVariantIds,
    };
  }

  async computeCheckoutDiscount(
    storeId: string,
    input: PromotionComputationInput,
    db?: Parameters<PromotionsRepository['findCouponByCodeForCheckout']>[0],
  ): Promise<PromotionComputationResult> {
    const productIds = [...new Set(input.items.map((item) => item.product_id))];
    const [offers, inlineProductOffers] = await Promise.all([
      this.promotionsRepository.listActiveOffers(storeId, input.at, db),
      this.promotionsRepository.listActiveInlineProductOffers(storeId, productIds, input.at, db),
    ]);

    const inlineOfferByProductId = new Map(
      inlineProductOffers.map((row) => [row.product_id, row] as const),
    );

    let inlineOfferDiscount = 0;
    const productIdsWithInlineOffer = new Set<string>();
    for (const item of input.items) {
      const inline = inlineOfferByProductId.get(item.product_id);
      if (!inline) {
        continue;
      }

      const lineSubtotal = Number(item.unit_price) * item.quantity;
      inlineOfferDiscount += this.promotionsRepository.calculateDiscount(
        Number(inline.discount_value),
        inline.discount_type,
        lineSubtotal,
      );
      productIdsWithInlineOffer.add(item.product_id);
    }
    inlineOfferDiscount = Number(inlineOfferDiscount.toFixed(2));

    const remainingItems = input.items.filter(
      (item) => !productIdsWithInlineOffer.has(item.product_id),
    );
    const remainingSubtotal = Number(
      remainingItems
        .reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)
        .toFixed(2),
    );

    const basicOffer = this.promotionsRepository.calculateBestOfferDiscount(
      offers,
      remainingSubtotal,
      remainingItems,
    );
    const advancedOffer = await this.advancedOffersService.computeBestDiscount(
      storeId,
      remainingItems,
      remainingSubtotal,
      input.at,
      db,
    );
    const bestExternalOffer =
      advancedOffer.discount > basicOffer.discount
        ? advancedOffer
        : { offerId: basicOffer.offerId, discount: basicOffer.discount };

    const offerDiscount = Number((inlineOfferDiscount + bestExternalOffer.discount).toFixed(2));
    const offerId =
      inlineOfferDiscount > 0 ? 'inline-product-offer' : (bestExternalOffer.offerId ?? null);

    const normalizedCouponCode = input.couponCode?.trim();

    const coupon = normalizedCouponCode
      ? db
        ? await this.promotionsRepository.findCouponByCodeForCheckout(
            db, storeId, normalizedCouponCode.toUpperCase(),
          )
        : await this.promotionsRepository.findCouponByCode(
            storeId, normalizedCouponCode.toUpperCase(),
          )
      : null;

    if (normalizedCouponCode && !coupon) {
      throw new CheckoutDomainException(CHECKOUT_ERROR_CODES.COUPON_INVALID, 'Coupon not found');
    }

    const externalEligibleItems = advancedOffer.discount > basicOffer.discount
      ? remainingItems
      : this.offerEligibleItems(
          offers.find((offer) => offer.id === basicOffer.offerId) ?? null,
          remainingItems,
        );
    const offerEligibleLineIds = [...new Set([
      ...input.items
        .filter((item) => productIdsWithInlineOffer.has(item.product_id))
        .map((item) => item.cart_item_id),
      ...externalEligibleItems.map((item) => item.cart_item_id),
    ])];
    const offerAllocation = allocateLargestRemainder(
      input.items
        .filter((item) => offerEligibleLineIds.includes(item.cart_item_id))
        .map((item) => ({
          key: item.cart_item_id,
          amount: Number(item.unit_price) * item.quantity,
        })),
      offerDiscount,
    );

    const couponEligibleItems = coupon
      ? input.items.filter((item) => this.isCouponLineEligible(coupon, item))
      : [];
    const couponEligibleLineIds = couponEligibleItems.map((item) => item.cart_item_id);
    const couponBase = Number(couponEligibleItems.reduce(
      (sum, item) => sum + Math.max(
        0,
        Number(item.unit_price) * item.quantity - (offerAllocation.get(item.cart_item_id) ?? 0),
      ),
      0,
    ).toFixed(2));

    let couponDiscount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    if (coupon) {
      this.assertCouponUsable(coupon, couponBase, input.at);
      couponDiscount = this.promotionsRepository.calculateDiscount(
        Number(coupon.discount_value),
        coupon.discount_type,
        couponBase,
      );
      if (coupon.maximum_discount !== null) {
        couponDiscount = Math.min(couponDiscount, Number(coupon.maximum_discount));
      }
      couponId = coupon.id;
      couponCode = coupon.code;
    }

    const totalDiscount = Number((offerDiscount + couponDiscount).toFixed(2));
    return {
      couponId,
      couponCode,
      couponIsFreeShipping: coupon?.is_free_shipping ?? false,
      couponDiscount,
      offerId,
      offerDiscount,
      totalDiscount,
      offerEligibleLineIds,
      couponEligibleLineIds,
    };
  }

  private offerEligibleItems(
    offer: OfferRecord | null,
    items: CartItemSnapshot[],
  ): CartItemSnapshot[] {
    if (!offer || offer.target_type === 'cart') return items;
    if (offer.target_type === 'product') {
      return items.filter((item) => item.product_id === offer.target_product_id);
    }
    return items.filter((item) => item.category_id === offer.target_category_id);
  }

  private isCouponLineEligible(coupon: CouponRecord, item: CartItemSnapshot): boolean {
    if (coupon.excluded_product_ids.includes(item.product_id)) return false;
    if (item.category_id && coupon.excluded_category_ids.includes(item.category_id)) return false;
    if (coupon.included_product_ids.length > 0 && !coupon.included_product_ids.includes(item.product_id)) {
      return false;
    }
    if (coupon.included_category_ids.length > 0 &&
        (!item.category_id || !coupon.included_category_ids.includes(item.category_id))) {
      return false;
    }
    return true;
  }

  async increaseCouponUsageInTransaction(
    db: {
      query: <T = unknown>(
        queryText: string,
        values?: unknown[],
      ) => Promise<{ rows: T[]; rowCount: number | null }>;
    },
    storeId: string,
    couponId: string,
  ): Promise<void> {
    const success = await this.promotionsRepository.incrementCouponUsage(db, storeId, couponId);
    if (!success) {
      throw new BadRequestException('Coupon usage limit reached');
    }
  }

  async applyCouponInTransaction(
    db: Parameters<PromotionsRepository['findCouponByCodeForCheckout']>[0],
    storeId: string,
    input: ApplyCouponDto,
  ): Promise<CouponApplyResult> {
    const coupon = await this.promotionsRepository.findCouponByCodeForCheckout(
      db,
      storeId,
      input.code.trim().toUpperCase(),
    );
    if (!coupon) throw new NotFoundException('Coupon not found');
    this.assertCouponUsable(coupon, input.subtotal, new Date());
    let discount = this.promotionsRepository.calculateDiscount(
      Number(coupon.discount_value),
      coupon.discount_type,
      input.subtotal,
    );
    if (coupon.maximum_discount !== null) {
      discount = Math.min(discount, Number(coupon.maximum_discount));
    }
    return {
      couponId: coupon.id,
      code: coupon.code,
      discount,
      subtotal: input.subtotal,
      isFreeShipping: coupon.is_free_shipping,
    };
  }

  async consumeCouponInTransaction(
    db: {
      query: <T = unknown>(
        queryText: string,
        values?: unknown[],
      ) => Promise<{ rows: T[]; rowCount: number | null }>;
    },
    input: {
      storeId: string;
      couponId: string;
      orderId: string;
      customerId: string | null;
      discountAmount: number;
      currencyCode: string;
      subtotal: number;
      productIds: string[];
      categoryIds: string[];
    },
  ): Promise<string> {
    try {
      const usage = await this.promotionsRepository.consumeCoupon(db, input);
      if (!usage.created) {
        this.metricsService.incrementCounter('coupon_duplicate_consume_replay_total', {
          store_id: input.storeId,
        });
        return usage.id;
      }
      await this.outboxService.enqueueInTransaction(db, {
        aggregateType: 'coupon-usage',
        aggregateId: usage.id,
        eventType: 'coupon.consumed',
        deduplicationKey: `coupon.consumed:${usage.id}`,
        payload: {
          storeId: input.storeId,
          orderId: input.orderId,
          couponId: input.couponId,
          couponCode: usage.code,
          discountAmount: input.discountAmount,
          currencyCode: input.currencyCode,
        },
      });
      return usage.id;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'COUPON_INVALID';
      if (code === 'COUPON_USAGE_LIMIT_REACHED') {
        throw new CheckoutDomainException(
          CHECKOUT_ERROR_CODES.COUPON_USAGE_LIMIT_REACHED,
          'Coupon usage limit reached',
        );
      }
      if (code === 'COUPON_CUSTOMER_LIMIT_REACHED') {
        throw new CheckoutDomainException(
          CHECKOUT_ERROR_CODES.COUPON_CUSTOMER_LIMIT_REACHED,
          'Customer coupon usage limit reached',
        );
      }
      if (code === 'COUPON_EXPIRED') {
        throw new CheckoutDomainException(
          CHECKOUT_ERROR_CODES.COUPON_EXPIRED,
          'Coupon has expired',
        );
      }
      throw new CheckoutDomainException(CHECKOUT_ERROR_CODES.COUPON_INVALID, 'Coupon is invalid');
    }
  }

  async reverseCouponInTransaction(
    db: Parameters<PromotionsRepository['reverseCouponUsage']>[0],
    input: { storeId: string; orderId: string; reason: string },
  ): Promise<boolean> {
    const reversed = await this.promotionsRepository.reverseCouponUsage(db, input);
    if (reversed) {
      this.metricsService.incrementCounter('coupon_reversal_total', { store_id: input.storeId });
      await this.outboxService.enqueueInTransaction(db, {
        aggregateType: 'coupon-usage',
        aggregateId: reversed.usageId,
        eventType: 'coupon.reversed',
        deduplicationKey: `coupon.reversed:${input.orderId}`,
        payload: input,
      });
      await this.auditService.log({
        action: 'coupon.usage_reversed', storeId: input.storeId,
        storeUserId: null, targetType: 'coupon_usage', targetId: reversed.usageId,
        beforeSnapshot: { status: 'consumed' }, afterSnapshot: { status: 'reversed' },
        metadata: { orderId: input.orderId, couponId: reversed.couponId, reason: input.reason },
      }, db);
    }
    return Boolean(reversed);
  }

  private validateDiscountType(discountType: string): void {
    if (!DISCOUNT_TYPES.includes(discountType as DiscountType)) {
      throw new BadRequestException('Invalid discount type');
    }
  }

  private validateDiscountValue(discountType: DiscountType, discountValue: number): void {
    if (discountType === 'percent' && discountValue > 100) {
      throw new BadRequestException('Percent discount must be between 0 and 100');
    }

    if (discountType === 'fixed' && discountValue < 0) {
      throw new BadRequestException('Fixed discount must be non-negative');
    }
  }

  private validateOfferTargets(
    targetType: OfferTargetType,
    targetProductId: string | null | undefined,
    targetCategoryId: string | null | undefined,
  ): void {
    if (!OFFER_TARGET_TYPES.includes(targetType)) {
      throw new BadRequestException('Invalid offer target type');
    }

    if (targetType === 'product' && !targetProductId) {
      throw new BadRequestException('targetProductId is required for product offers');
    }

    if (targetType === 'category' && !targetCategoryId) {
      throw new BadRequestException('targetCategoryId is required for category offers');
    }
  }

  private validateDateWindow(startsAt?: string | null, endsAt?: string | null): void {
    if (!startsAt || !endsAt) {
      return;
    }
    if (new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException('Promotion start date must be before end date');
    }
  }

  private resolveDate(nextDate: string | undefined, fallback: Date | null): Date | null {
    if (!nextDate) {
      return fallback;
    }
    return new Date(nextDate);
  }

  private async buildCouponUpdatePayload(
    storeId: string,
    couponId: string,
    input: UpdateCouponDto,
    existing: CouponRecord,
  ): Promise<{
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number;
    startsAt: Date | null;
    endsAt: Date | null;
    maxUses: number | null;
    isActive: boolean;
    affiliateId: string | null;
    isFreeShipping: boolean;
    perCustomerLimit: number | null;
    maximumDiscount: number | null;
    currencyCode: string | null;
    includedProductIds: string[];
    excludedProductIds: string[];
    includedCategoryIds: string[];
    excludedCategoryIds: string[];
  }> {
    const code = this.resolveCouponCode(input.code, existing.code);
    await this.assertCouponCodeAvailable(storeId, couponId, code, existing.code);

    const discountType = input.discountType ?? existing.discount_type;
    this.validateDiscountType(discountType);
    const discountValue = input.discountValue ?? Number(existing.discount_value);
    this.validateDiscountValue(discountType, discountValue);
    const startsAt = this.resolveDate(input.startsAt, existing.starts_at);
    const endsAt = this.resolveDate(input.endsAt, existing.ends_at);
    this.validateDateWindow(startsAt?.toISOString(), endsAt?.toISOString());
    const affiliateId = input.affiliateId === undefined ? existing.affiliate_id : input.affiliateId;
    await this.assertValidAffiliateId(storeId, affiliateId);

    return {
      code,
      discountType,
      discountValue,
      minOrderAmount: input.minOrderAmount ?? Number(existing.min_order_amount),
      startsAt,
      endsAt,
      maxUses: input.maxUses ?? existing.max_uses,
      isActive: input.isActive ?? existing.is_active,
      affiliateId,
      isFreeShipping: input.isFreeShipping ?? existing.is_free_shipping,
      perCustomerLimit: input.perCustomerLimit === undefined
        ? existing.per_customer_limit : input.perCustomerLimit,
      maximumDiscount: input.maximumDiscount === undefined
        ? existing.maximum_discount === null ? null : Number(existing.maximum_discount)
        : input.maximumDiscount,
      currencyCode: input.currencyCode === undefined
        ? existing.currency_code : input.currencyCode?.trim().toUpperCase() ?? null,
      includedProductIds: input.includedProductIds ?? existing.included_product_ids,
      excludedProductIds: input.excludedProductIds ?? existing.excluded_product_ids,
      includedCategoryIds: input.includedCategoryIds ?? existing.included_category_ids,
      excludedCategoryIds: input.excludedCategoryIds ?? existing.excluded_category_ids,
    };
  }

  private async assertValidAffiliateId(storeId: string, affiliateId: string | null): Promise<void> {
    if (!affiliateId) {
      return;
    }

    const exists = await this.promotionsRepository.affiliateExistsForStore(storeId, affiliateId);
    if (!exists) {
      throw new BadRequestException('Affiliate not found or inactive');
    }
  }

  private buildOfferUpdatePayload(
    input: UpdateOfferDto,
    existing: OfferRecord,
  ): {
    name: string;
    targetType: OfferTargetType;
    targetProductId: string | null;
    targetCategoryId: string | null;
    discountType: DiscountType;
    discountValue: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
  } {
    const targets = this.resolveOfferTargets(input, existing);
    const discountWindow = this.resolveOfferDiscountWindow(input, existing);
    const discountValue = input.discountValue ?? Number(existing.discount_value);
    this.validateDiscountValue(discountWindow.discountType, discountValue);

    return {
      name: input.name?.trim() ?? existing.name,
      ...targets,
      ...discountWindow,
      discountValue,
      isActive: input.isActive ?? existing.is_active,
    };
  }

  private resolveOfferTargets(
    input: UpdateOfferDto,
    existing: OfferRecord,
  ): {
    targetType: OfferTargetType;
    targetProductId: string | null;
    targetCategoryId: string | null;
  } {
    const targetType = input.targetType ?? existing.target_type;
    const targetProductId = input.targetProductId ?? existing.target_product_id;
    const targetCategoryId = input.targetCategoryId ?? existing.target_category_id;
    this.validateOfferTargets(targetType, targetProductId, targetCategoryId);
    return { targetType, targetProductId, targetCategoryId };
  }

  private resolveOfferDiscountWindow(
    input: UpdateOfferDto,
    existing: OfferRecord,
  ): { discountType: DiscountType; startsAt: Date | null; endsAt: Date | null } {
    const discountType = input.discountType ?? existing.discount_type;
    this.validateDiscountType(discountType);
    const startsAt = this.resolveDate(input.startsAt, existing.starts_at);
    const endsAt = this.resolveDate(input.endsAt, existing.ends_at);
    this.validateDateWindow(startsAt?.toISOString(), endsAt?.toISOString());
    return { discountType, startsAt, endsAt };
  }

  private resolveCouponCode(nextCode: string | undefined, fallback: string): string {
    return nextCode?.trim().toUpperCase() ?? fallback;
  }

  private async assertCouponCodeAvailable(
    storeId: string,
    couponId: string,
    nextCode: string,
    currentCode: string,
  ): Promise<void> {
    if (nextCode === currentCode) {
      return;
    }

    const conflict = await this.promotionsRepository.findCouponByCode(storeId, nextCode);
    if (conflict && conflict.id !== couponId) {
      throw new ConflictException('Coupon code already exists');
    }
  }

  private async requireCouponByCode(storeId: string, code: string): Promise<CouponRecord> {
    const coupon = await this.promotionsRepository.findCouponByCode(
      storeId,
      code.trim().toUpperCase(),
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  private assertCouponUsable(coupon: CouponRecord, subtotal: number, now: Date): void {
    if (!coupon.is_active) {
      throw new CheckoutDomainException(CHECKOUT_ERROR_CODES.COUPON_INVALID, 'Coupon is not active');
    }
    if (coupon.starts_at && coupon.starts_at.getTime() > now.getTime()) {
      throw new CheckoutDomainException(CHECKOUT_ERROR_CODES.COUPON_INVALID, 'Coupon not started yet');
    }
    if (coupon.ends_at && coupon.ends_at.getTime() < now.getTime()) {
      throw new CheckoutDomainException(CHECKOUT_ERROR_CODES.COUPON_EXPIRED, 'Coupon expired');
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      throw new CheckoutDomainException(
        CHECKOUT_ERROR_CODES.COUPON_USAGE_LIMIT_REACHED,
        'Coupon usage limit reached',
      );
    }
    if (subtotal < Number(coupon.min_order_amount)) {
      throw new CheckoutDomainException(
        CHECKOUT_ERROR_CODES.COUPON_INVALID,
        'Order does not meet coupon minimum amount',
      );
    }
  }

  private async log(
    action: string,
    currentUser: AuthUser,
    targetId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'promotion',
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private mapCoupon(row: CouponRecord): CouponResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      code: row.code,
      affiliateId: row.affiliate_id,
      isFreeShipping: row.is_free_shipping,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      minOrderAmount: Number(row.min_order_amount),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      isActive: row.is_active,
      perCustomerLimit: row.per_customer_limit,
      maximumDiscount: row.maximum_discount === null ? null : Number(row.maximum_discount),
      currencyCode: row.currency_code,
      includedProductIds: row.included_product_ids,
      excludedProductIds: row.excluded_product_ids,
      includedCategoryIds: row.included_category_ids,
      excludedCategoryIds: row.excluded_category_ids,
    };
  }

  private mapOffer(row: OfferRecord): OfferResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      targetType: row.target_type,
      targetProductId: row.target_product_id,
      targetCategoryId: row.target_category_id,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
    };
  }
}
