import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { CartItemSnapshot } from '../orders/orders.repository';
import {
  ADVANCED_OFFER_TYPES,
  type AdvancedOfferConfig,
  type AdvancedOfferType,
  type BundleConfig,
  type BxgyConfig,
  type TieredDiscountConfig,
} from './constants/advanced-offer.constants';
import type { CreateAdvancedOfferDto } from './dto/create-advanced-offer.dto';
import type { UpdateAdvancedOfferDto } from './dto/update-advanced-offer.dto';
import { AdvancedOffersRepository, type AdvancedOfferRecord } from './advanced-offers.repository';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';

export interface AdvancedOfferResponse {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  offerType: AdvancedOfferType;
  config: AdvancedOfferConfig;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdvancedOfferDiscountResult {
  offerId: string | null;
  discount: number;
}

@Injectable()
export class AdvancedOffersService {
  constructor(
    private readonly advancedOffersRepository: AdvancedOffersRepository,
    private readonly auditService: AuditService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateAdvancedOfferDto,
    context: RequestContextData,
  ): Promise<AdvancedOfferResponse> {
    await this.storeCapabilitiesService.assertFeatureEnabled(
      currentUser.storeId,
      'advanced_promotions',
    );
    this.validateInput(input.offerType, input.config, input.startsAt, input.endsAt);

    const created = await this.advancedOffersRepository.create({
      storeId: currentUser.storeId,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      offerType: input.offerType as AdvancedOfferType,
      config: input.config,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
    });

    await this.log('advanced_offers.created', currentUser, created.id, context);
    return this.toResponse(created);
  }

  async list(currentUser: AuthUser): Promise<AdvancedOfferResponse[]> {
    const rows = await this.advancedOffersRepository.list(currentUser.storeId);
    return rows.map((row) => this.toResponse(row));
  }

  async update(
    currentUser: AuthUser,
    offerId: string,
    input: UpdateAdvancedOfferDto,
    context: RequestContextData,
  ): Promise<AdvancedOfferResponse> {
    await this.storeCapabilitiesService.assertFeatureEnabled(
      currentUser.storeId,
      'advanced_promotions',
    );
    const existing = await this.advancedOffersRepository.findById(currentUser.storeId, offerId);
    if (!existing) {
      throw new NotFoundException('Advanced offer not found');
    }

    const offerType = (input.offerType ?? existing.offer_type) as AdvancedOfferType;
    const config = (input.config ?? existing.config) as AdvancedOfferConfig;
    const startsAt = input.startsAt
      ? new Date(input.startsAt)
      : input.startsAt === null
        ? null
        : existing.starts_at;
    const endsAt = input.endsAt
      ? new Date(input.endsAt)
      : input.endsAt === null
        ? null
        : existing.ends_at;

    this.validateInput(
      offerType,
      config,
      startsAt ? startsAt.toISOString() : null,
      endsAt ? endsAt.toISOString() : null,
    );

    const updated = await this.advancedOffersRepository.update({
      storeId: currentUser.storeId,
      offerId,
      name: input.name?.trim() ?? existing.name,
      description: input.description?.trim() ?? existing.description,
      offerType,
      config,
      startsAt,
      endsAt,
      isActive: input.isActive ?? existing.is_active,
      priority: input.priority ?? existing.priority,
    });

    if (!updated) {
      throw new NotFoundException('Advanced offer not found');
    }

    await this.log('advanced_offers.updated', currentUser, offerId, context);
    return this.toResponse(updated);
  }

  async computeBestDiscount(
    storeId: string,
    items: CartItemSnapshot[],
    subtotal: number,
    at: Date,
  ): Promise<AdvancedOfferDiscountResult> {
    const offers = await this.advancedOffersRepository.listActive(storeId, at);
    let winner: AdvancedOfferDiscountResult = { offerId: null, discount: 0 };

    for (const offer of offers) {
      const discount = this.computeOfferDiscount(offer, items, subtotal);
      if (discount > winner.discount) {
        winner = { offerId: offer.id, discount };
      }
    }

    return {
      offerId: winner.offerId,
      discount: Number(winner.discount.toFixed(2)),
    };
  }

  private computeOfferDiscount(
    offer: AdvancedOfferRecord,
    items: CartItemSnapshot[],
    subtotal: number,
  ): number {
    switch (offer.offer_type) {
      case 'bxgy':
        return this.computeBxgyDiscount(offer.config.bxgy, items);
      case 'bundle':
        return this.computeBundleDiscount(offer.config.bundle, items);
      case 'tiered_discount':
        return this.computeTieredDiscount(offer.config.tieredDiscount, items, subtotal);
      default:
        return 0;
    }
  }

  private computeBxgyDiscount(config: BxgyConfig | undefined, items: CartItemSnapshot[]): number {
    if (!config) {
      return 0;
    }

    const buyQty = this.sumQuantitiesByProducts(items, config.buyProductIds);
    const getQty = this.sumQuantitiesByProducts(items, config.getXProductIds);
    if (buyQty < config.buyQuantity || getQty <= 0) {
      return 0;
    }

    const eligibleSets = Math.floor(buyQty / config.buyQuantity);
    const discountedUnits = Math.min(getQty, eligibleSets * config.getXQuantity);
    const discountedBase = this.sumHighestPricedUnits(
      items,
      config.getXProductIds,
      discountedUnits,
    );
    return (discountedBase * config.discountPercent) / 100;
  }

  private computeBundleDiscount(
    config: BundleConfig | undefined,
    items: CartItemSnapshot[],
  ): number {
    if (!config || config.productIds.length === 0) {
      return 0;
    }

    const quantities = config.productIds.map((productId) =>
      items
        .filter((item) => item.product_id === productId)
        .reduce((sum, item) => sum + item.quantity, 0),
    );
    const bundleCount = Math.min(...quantities);
    if (!Number.isFinite(bundleCount) || bundleCount <= 0) {
      return 0;
    }

    const bundleBase = this.sumBundleBase(items, config.productIds, bundleCount);
    if (bundleBase <= 0) {
      return 0;
    }

    if (typeof config.fixedPrice === 'number' && config.fixedPrice >= 0) {
      const fixedDiscount = bundleBase - config.fixedPrice * bundleCount;
      return Math.max(0, fixedDiscount);
    }

    return (bundleBase * config.discountPercent) / 100;
  }

  private computeTieredDiscount(
    config: TieredDiscountConfig | undefined,
    items: CartItemSnapshot[],
    subtotal: number,
  ): number {
    if (!config || config.tiers.length === 0) {
      return 0;
    }

    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const matchingTier = [...config.tiers]
      .sort((a, b) => b.minQuantity - a.minQuantity)
      .find((tier) => totalQty >= tier.minQuantity);

    if (!matchingTier) {
      return 0;
    }

    return (subtotal * matchingTier.discountPercent) / 100;
  }

  private sumQuantitiesByProducts(items: CartItemSnapshot[], productIds: string[]): number {
    const target = new Set(productIds);
    return items
      .filter((item) => target.has(item.product_id))
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  private sumHighestPricedUnits(
    items: CartItemSnapshot[],
    productIds: string[],
    units: number,
  ): number {
    const target = new Set(productIds);
    const unitPrices: number[] = [];

    for (const item of items) {
      if (!target.has(item.product_id)) {
        continue;
      }

      for (let i = 0; i < item.quantity; i += 1) {
        unitPrices.push(Number(item.unit_price));
      }
    }

    unitPrices.sort((a, b) => b - a);
    return unitPrices.slice(0, units).reduce((sum, value) => sum + value, 0);
  }

  private sumBundleBase(
    items: CartItemSnapshot[],
    productIds: string[],
    bundleCount: number,
  ): number {
    const target = new Set(productIds);
    let total = 0;

    for (const productId of target.values()) {
      const productItems = items
        .filter((item) => item.product_id === productId)
        .flatMap((item) => Array(item.quantity).fill(Number(item.unit_price)))
        .sort((a, b) => b - a);

      total += productItems.slice(0, bundleCount).reduce((sum, value) => sum + value, 0);
    }

    return total;
  }

  private validateInput(
    offerType: string,
    config: AdvancedOfferConfig,
    startsAt?: string | null,
    endsAt?: string | null,
  ): void {
    if (!ADVANCED_OFFER_TYPES.includes(offerType as AdvancedOfferType)) {
      throw new BadRequestException('Invalid advanced offer type');
    }

    if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      throw new BadRequestException('Offer start date must be before end date');
    }

    if (offerType === 'bxgy') {
      this.validateBxgy(config.bxgy);
      return;
    }

    if (offerType === 'bundle') {
      this.validateBundle(config.bundle);
      return;
    }

    this.validateTiered(config.tieredDiscount);
  }

  private validateBxgy(config: BxgyConfig | undefined): void {
    if (!config) {
      throw new BadRequestException('bxgy config is required');
    }

    if (config.buyQuantity <= 0 || config.getXQuantity <= 0) {
      throw new BadRequestException('bxgy quantities must be greater than zero');
    }

    if (config.buyProductIds.length === 0 || config.getXProductIds.length === 0) {
      throw new BadRequestException('bxgy products are required');
    }

    if (config.discountPercent <= 0 || config.discountPercent > 100) {
      throw new BadRequestException('bxgy discountPercent must be between 0 and 100');
    }
  }

  private validateBundle(config: BundleConfig | undefined): void {
    if (!config) {
      throw new BadRequestException('bundle config is required');
    }

    if (config.productIds.length < 2) {
      throw new BadRequestException('bundle offer requires at least two products');
    }

    if (config.discountPercent < 0 || config.discountPercent > 100) {
      throw new BadRequestException('bundle discountPercent must be between 0 and 100');
    }

    if (config.fixedPrice !== undefined && config.fixedPrice < 0) {
      throw new BadRequestException('bundle fixedPrice must be non-negative');
    }
  }

  private validateTiered(config: TieredDiscountConfig | undefined): void {
    if (!config || config.tiers.length === 0) {
      throw new BadRequestException('tieredDiscount tiers are required');
    }

    const ordered = [...config.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    for (const tier of ordered) {
      if (tier.minQuantity <= 0) {
        throw new BadRequestException('tier minQuantity must be greater than zero');
      }

      if (tier.discountPercent <= 0 || tier.discountPercent > 100) {
        throw new BadRequestException('tier discountPercent must be between 0 and 100');
      }
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
      targetType: 'advanced_offer',
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(row: AdvancedOfferRecord): AdvancedOfferResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      description: row.description,
      offerType: row.offer_type,
      config: row.config,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
