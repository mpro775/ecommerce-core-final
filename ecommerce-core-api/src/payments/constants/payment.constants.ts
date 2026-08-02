export const PAYMENT_METHODS = ['cod', 'transfer'] as const;
export type PaymentMethod = string;

export const PAYMENT_STATUSES = [
  'pending',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'expired',
  'cancelled',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function canTransitionPaymentStatus(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === next) return false;

  const transitions: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ['submitted', 'approved', 'expired', 'cancelled'],
    submitted: ['under_review', 'expired', 'cancelled'],
    under_review: ['approved', 'rejected'],
    approved: ['partially_refunded', 'refunded'],
    rejected: ['submitted'],
    expired: [],
    cancelled: [],
    partially_refunded: ['partially_refunded', 'refunded'],
    refunded: [],
  };

  return transitions[current]?.includes(next) ?? false;
}
