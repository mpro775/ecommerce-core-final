export const SHIPPING_METHOD_TYPES = [
  'flat_rate',
  'by_weight',
  'by_item',
  'weight_tier',
  'order_value_tier',
  'free_shipping',
  'store_pickup',
] as const;

export type ShippingMethodType = (typeof SHIPPING_METHOD_TYPES)[number];

export const FREE_SHIPPING_CONDITION_TYPES = ['none', 'coupon', 'min_order_amount'] as const;

export type FreeShippingConditionType = (typeof FREE_SHIPPING_CONDITION_TYPES)[number];
