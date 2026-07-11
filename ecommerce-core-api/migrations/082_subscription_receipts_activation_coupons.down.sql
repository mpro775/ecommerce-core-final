DROP TABLE IF EXISTS subscription_payment_receipts;

ALTER TABLE subscription_coupons
  DROP COLUMN IF EXISTS purpose,
  DROP COLUMN IF EXISTS accounting_category,
  DROP COLUMN IF EXISTS affects_revenue,
  DROP COLUMN IF EXISTS activate_plan_code;

ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_discount_type_check;

ALTER TABLE subscription_coupons
  ADD CONSTRAINT subscription_coupons_discount_type_check
  CHECK (discount_type IN ('percent', 'fixed', 'free_months'));
