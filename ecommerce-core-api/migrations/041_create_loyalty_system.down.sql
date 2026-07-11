ALTER TABLE stores
  DROP COLUMN IF EXISTS loyalty_policy;

ALTER TABLE orders
  DROP COLUMN IF EXISTS points_earned,
  DROP COLUMN IF EXISTS points_discount_amount,
  DROP COLUMN IF EXISTS points_redeemed;

DROP TABLE IF EXISTS loyalty_ledger_entries;
DROP TABLE IF EXISTS customer_loyalty_wallets;
DROP TABLE IF EXISTS loyalty_earn_rules;
DROP TABLE IF EXISTS loyalty_programs;
