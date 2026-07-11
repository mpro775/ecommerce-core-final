export const LOYALTY_ENTRY_TYPES = ['earn', 'redeem', 'adjust', 'reverse'] as const;
export type LoyaltyEntryType = (typeof LOYALTY_ENTRY_TYPES)[number];

export const LOYALTY_RULE_TYPES = ['order_percent'] as const;
export type LoyaltyRuleType = (typeof LOYALTY_RULE_TYPES)[number];
