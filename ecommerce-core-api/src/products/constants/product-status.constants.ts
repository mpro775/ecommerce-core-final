export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
