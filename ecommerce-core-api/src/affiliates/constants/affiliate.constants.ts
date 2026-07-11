export const AFFILIATE_STATUSES = ['active', 'inactive'] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

export const AFFILIATE_ATTRIBUTION_TYPES = ['coupon', 'link'] as const;
export type AffiliateAttributionType = (typeof AFFILIATE_ATTRIBUTION_TYPES)[number];

export const AFFILIATE_COMMISSION_STATUSES = ['pending', 'approved', 'reversed', 'paid'] as const;
export type AffiliateCommissionStatus = (typeof AFFILIATE_COMMISSION_STATUSES)[number];

export const AFFILIATE_PAYOUT_BATCH_STATUSES = ['draft', 'finalized', 'paid'] as const;
export type AffiliatePayoutBatchStatus = (typeof AFFILIATE_PAYOUT_BATCH_STATUSES)[number];
