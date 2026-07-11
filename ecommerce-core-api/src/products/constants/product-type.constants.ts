export const PRODUCT_TYPES = ['single', 'bundled', 'digital'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];
