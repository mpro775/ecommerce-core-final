import type { PaymentStatus } from './constants/payment.constants';

export type PaymentCommand = 'submitPaymentProof' | 'resubmitPaymentProof' | 'startPaymentReview' |
  'approvePayment' | 'rejectPayment' | 'collectCodPayment' | 'expirePayment' | 'cancelPayment';

export const PAYMENT_COMMAND_RULES: Record<PaymentCommand, {
  from: PaymentStatus[]; to: PaymentStatus; permission: string; reasonRequired: boolean;
  eventType: string;
}> = {
  submitPaymentProof: { from: ['pending'], to: 'submitted', permission: 'payments:submit-proof',
    reasonRequired: false, eventType: 'payment.submitted' },
  resubmitPaymentProof: { from: ['rejected'], to: 'submitted', permission: 'payments:submit-proof',
    reasonRequired: false, eventType: 'payment.submitted' },
  startPaymentReview: { from: ['submitted'], to: 'under_review', permission: 'payments:start-review',
    reasonRequired: false, eventType: 'payment.review_started' },
  approvePayment: { from: ['under_review'], to: 'approved', permission: 'payments:approve',
    reasonRequired: false, eventType: 'payment.approved' },
  rejectPayment: { from: ['under_review'], to: 'rejected', permission: 'payments:reject',
    reasonRequired: true, eventType: 'payment.rejected' },
  collectCodPayment: { from: ['pending'], to: 'approved', permission: 'payments:collect-cod',
    reasonRequired: false, eventType: 'payment.collected' },
  expirePayment: { from: ['pending', 'submitted'], to: 'expired', permission: 'payments:expire',
    reasonRequired: false, eventType: 'payment.expired' },
  cancelPayment: { from: ['pending', 'submitted', 'under_review'], to: 'cancelled',
    permission: 'payments:cancel', reasonRequired: true, eventType: 'payment.cancelled' },
};
