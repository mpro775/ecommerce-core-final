ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_compare_at_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS annual_compare_at_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS sale_label TEXT,
  ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_intro_offer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_sale_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_monthly_compare_at_check,
  ADD CONSTRAINT plans_monthly_compare_at_check
    CHECK (monthly_compare_at_price IS NULL OR monthly_price IS NULL OR monthly_compare_at_price > monthly_price);

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_annual_compare_at_check,
  ADD CONSTRAINT plans_annual_compare_at_check
    CHECK (annual_compare_at_price IS NULL OR annual_price IS NULL OR annual_compare_at_price > annual_price);

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_sale_dates_check,
  ADD CONSTRAINT plans_sale_dates_check
    CHECK (sale_ends_at IS NULL OR sale_starts_at IS NULL OR sale_ends_at > sale_starts_at);

CREATE TABLE IF NOT EXISTS subscription_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  signup_trial_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  signup_trial_plan_code TEXT,
  signup_trial_days INTEGER NOT NULL DEFAULT 30 CHECK (signup_trial_days >= 0),
  after_trial_behavior TEXT NOT NULL DEFAULT 'downgrade_to_free'
    CHECK (after_trial_behavior IN ('downgrade_to_free', 'mark_past_due', 'suspend_paid_features', 'create_invoice')),
  free_plan_code TEXT,
  allow_trial_plan_change BOOLEAN NOT NULL DEFAULT FALSE,
  one_trial_per_store BOOLEAN NOT NULL DEFAULT TRUE,
  one_trial_per_owner BOOLEAN NOT NULL DEFAULT TRUE,
  trial_requires_payment_method BOOLEAN NOT NULL DEFAULT FALSE,
  trial_reminder_days_before INTEGER[] NOT NULL DEFAULT ARRAY[7, 3, 1]::INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_settings (
  singleton_key,
  signup_trial_enabled,
  signup_trial_plan_code,
  signup_trial_days,
  after_trial_behavior,
  free_plan_code,
  allow_trial_plan_change,
  one_trial_per_store,
  one_trial_per_owner,
  trial_requires_payment_method,
  trial_reminder_days_before
)
VALUES (
  'default',
  EXISTS (SELECT 1 FROM plans WHERE LOWER(code) = 'growth' AND is_active = TRUE),
  CASE
    WHEN EXISTS (SELECT 1 FROM plans WHERE LOWER(code) = 'growth' AND is_active = TRUE) THEN 'growth'
    ELSE NULL
  END,
  30,
  'downgrade_to_free',
  CASE
    WHEN EXISTS (SELECT 1 FROM plans WHERE LOWER(code) = 'free') THEN 'free'
    ELSE NULL
  END,
  FALSE,
  TRUE,
  TRUE,
  FALSE,
  ARRAY[7, 3, 1]::INTEGER[]
)
ON CONFLICT (singleton_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscription_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_months')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value >= 0),
  currency_code TEXT NOT NULL DEFAULT 'YER',
  duration_months INTEGER NOT NULL DEFAULT 1 CHECK (duration_months >= 1),
  applies_to_plan_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_store INTEGER CHECK (max_redemptions_per_store IS NULL OR max_redemptions_per_store > 0),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_coupons_dates_check CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_subscription_coupons_code
  ON subscription_coupons (LOWER(code));

CREATE TABLE IF NOT EXISTS subscription_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES subscription_coupons(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES store_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES subscription_invoices(id) ON DELETE SET NULL,
  coupon_code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12, 2) NOT NULL,
  billing_cycle TEXT NOT NULL,
  original_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL,
  final_amount NUMERIC(12, 2) NOT NULL,
  free_months INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_coupon_redemptions_coupon
  ON subscription_coupon_redemptions (coupon_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_coupon_redemptions_store
  ON subscription_coupon_redemptions (store_id, redeemed_at DESC);

ALTER TABLE subscription_invoices
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

INSERT INTO subscription_coupons (
  code,
  name,
  description,
  discount_type,
  discount_value,
  duration_months,
  applies_to_plan_codes,
  is_active,
  metadata
)
VALUES
  ('LAUNCH30', 'Launch 30%', '30% off the first subscription month', 'percent', 30, 1, ARRAY[]::TEXT[], TRUE, '{"seed":"development"}'::JSONB),
  ('FREEBUSINESS', 'Free Business Month', 'One free month on Business', 'free_months', 1, 1, ARRAY['business']::TEXT[], TRUE, '{"seed":"development"}'::JSONB),
  ('GROWTH3', 'Growth 3 Months', '20% off the first three Growth months', 'percent', 20, 3, ARRAY['growth']::TEXT[], TRUE, '{"seed":"development"}'::JSONB)
ON CONFLICT (code) DO NOTHING;
