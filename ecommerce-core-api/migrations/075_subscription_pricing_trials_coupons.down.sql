ALTER TABLE subscription_invoices
  DROP COLUMN IF EXISTS coupon_code,
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS original_amount;

DROP TABLE IF EXISTS subscription_coupon_redemptions;
DROP TABLE IF EXISTS subscription_coupons;
DROP TABLE IF EXISTS subscription_settings;

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_sale_dates_check,
  DROP CONSTRAINT IF EXISTS plans_annual_compare_at_check,
  DROP CONSTRAINT IF EXISTS plans_monthly_compare_at_check,
  DROP COLUMN IF EXISTS is_sale_active,
  DROP COLUMN IF EXISTS is_intro_offer,
  DROP COLUMN IF EXISTS sale_ends_at,
  DROP COLUMN IF EXISTS sale_starts_at,
  DROP COLUMN IF EXISTS sale_label,
  DROP COLUMN IF EXISTS annual_compare_at_price,
  DROP COLUMN IF EXISTS monthly_compare_at_price;
