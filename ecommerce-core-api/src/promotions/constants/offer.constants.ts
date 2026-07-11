export const OFFER_TARGET_TYPES = ['product', 'category', 'cart'] as const;
export type OfferTargetType = (typeof OFFER_TARGET_TYPES)[number];
