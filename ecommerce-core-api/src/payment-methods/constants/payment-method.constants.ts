export const PAYMENT_METHOD_TYPES = [
  'cod',
  'wallet',
  'bank_transfer',
  'exchange_transfer',
  'custom_manual',
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export type DynamicPaymentMethod = string;

export const LEGACY_PAYMENT_METHODS = ['cod', 'transfer'] as const;
