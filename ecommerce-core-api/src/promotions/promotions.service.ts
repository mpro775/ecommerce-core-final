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
import { WebhooksService } from '../webhooks/webhooks.service';
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
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly promotionsRepository: PromotionsRepository,
    private readonly auditService: AuditService,
    private readonly webhooksService: WebhooksService,
    private readonly advancedOffersService: AdvancedOffersService,
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
    await this.webhooksService.dispatchEvent(currentUser.storeId, 'coupon.updated', {
      couponId: updated.id,
      code: updated.code,
      isActive: updated.is_active,
      discountType: updated.discount_type,
      discountValue: Number(updated.discount_value),
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

  async computeCheckoutDiscount(
    storeId: string,
    input: PromotionComputationInput,
  ): Promise<PromotionComputationResult> {
    const productIds = [...new Set(input.items.map((item) => item.product_id))];
    const [offers, inlineProductOffers] = await Promise.all([
      this.promotionsRepository.listActiveOffers(storeId, input.at),
      this.promotionsRepository.listActiveInlineProductOffers(storeId, productIds, input.at),
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
      ? await this.promotionsRepository.findCouponByCode(
          storeId,
          normalizedCouponCode.toUpperCase(),
        )
      : null;

    if (normalizedCouponCode && !coupon) {
      throw new NotFoundException('Coupon not found');
    }

    let couponDiscount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    if (coupon) {
      this.assertCouponUsable(coupon, input.subtotal - offerDiscount, input.at);
      couponDiscount = this.promotionsRepository.calculateDiscount(
        Number(coupon.discount_value),
        coupon.discount_type,
        input.subtotal - offerDiscount,
      );
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
    };
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
      throw new BadRequestException('Coupon is not active');
    }
    if (coupon.starts_at && coupon.starts_at.getTime() > now.getTime()) {
      throw new BadRequestException('Coupon not started yet');
    }
    if (coupon.ends_at && coupon.ends_at.getTime() < now.getTime()) {
      throw new BadRequestException('Coupon expired');
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (subtotal < Number(coupon.min_order_amount)) {
      throw new BadRequestException('Order does not meet coupon minimum amount');
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
