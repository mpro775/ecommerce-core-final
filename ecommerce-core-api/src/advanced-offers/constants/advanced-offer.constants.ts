export const ADVANCED_OFFER_TYPES = ['bxgy', 'bundle', 'tiered_discount'] as const;
export type AdvancedOfferType = (typeof ADVANCED_OFFER_TYPES)[number];

export interface BxgyConfig {
  buyQuantity: number;
  buyProductIds: string[];
  getXQuantity: number;
  getXProductIds: string[];
  discountPercent: number;
}

export interface BundleConfig {
  productIds: string[];
  discountPercent: number;
  fixedPrice?: number;
}

export interface TieredDiscountConfig {
  tiers: Array<{
    minQuantity: number;
    discountPercent: number;
  }>;
}

export interface AdvancedOfferConfig {
  bxgy?: BxgyConfig;
  bundle?: BundleConfig;
  tieredDiscount?: TieredDiscountConfig;
}
