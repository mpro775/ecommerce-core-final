export const PAYMENT_METHODS = ['cod', 'transfer'] as const;
export type PaymentMethod = string;

export const PAYMENT_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function canTransitionPaymentStatus(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === next) return false;

  const transitions: Record<PaymentStatus, PaymentStatus[]> = {
    pending: ['under_review', 'approved', 'rejected'],
    under_review: ['approved', 'rejected'],
    approved: ['refunded'],
    rejected: ['under_review'],
    refunded: [],
  };

  return transitions[current]?.includes(next) ?? false;
}
