ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS annual_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS billing_cycle_options TEXT[] NOT NULL DEFAULT ARRAY['monthly']::text[],
  ADD COLUMN IF NOT EXISTS trial_days_default INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE plans
  ADD CONSTRAINT plans_monthly_price_non_negative CHECK (monthly_price IS NULL OR monthly_price >= 0),
  ADD CONSTRAINT plans_annual_price_non_negative CHECK (annual_price IS NULL OR annual_price >= 0),
  ADD CONSTRAINT plans_trial_days_default_non_negative CHECK (trial_days_default >= 0),
  ADD CONSTRAINT plans_billing_cycle_options_non_empty CHECK (array_length(billing_cycle_options, 1) >= 1);

CREATE TABLE IF NOT EXISTS plan_entitlements (
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL CHECK (
    feature_key IN (
      'custom_domains',
      'advanced_promotions',
      'priority_support',
      'advanced_analytics',
      'api_access',
      'webhooks_access',
      'staff_management',
      'affiliate_program',
      'loyalty_program'
    )
  ),
  is_enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_entitlements_plan_feature_unique
  ON plan_entitlements (plan_id, feature_key);

ALTER TABLE store_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'manual')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES store_subscriptions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual', 'proration', 'manual')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  subtotal_amount NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'failed', 'void')),
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  external_invoice_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_invoices_invoice_number_unique
  ON subscription_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_store_created
  ON subscription_invoices (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_status
  ON subscription_invoices (subscription_id, status);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  amount NUMERIC(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  external_transaction_id TEXT,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_invoice
  ON subscription_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_store_created
  ON subscription_payments (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('provider_webhook', 'internal_admin', 'merchant_action', 'system_scheduler')),
  event_type TEXT NOT NULL,
  idempotency_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_source_idempotency_unique
  ON billing_events (source, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_events_store_created
  ON billing_events (store_id, created_at DESC);

UPDATE plans
SET
  monthly_price = CASE LOWER(code)
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 29
    WHEN 'business' THEN 99
    ELSE monthly_price
  END,
  annual_price = CASE LOWER(code)
    WHEN 'free' THEN 0
    WHEN 'pro' THEN 290
    WHEN 'business' THEN 990
    ELSE annual_price
  END,
  currency_code = COALESCE(NULLIF(currency_code, ''), 'YER'),
  billing_cycle_options = CASE LOWER(code)
    WHEN 'free' THEN ARRAY['monthly']::text[]
    ELSE ARRAY['monthly', 'annual']::text[]
  END,
  trial_days_default = CASE LOWER(code)
    WHEN 'pro' THEN 14
    WHEN 'business' THEN 14
    ELSE 0
  END,
  metadata = COALESCE(metadata, '{}'::jsonb),
  updated_at = NOW();

INSERT INTO plan_limits (id, plan_id, metric_key, metric_limit, reset_period)
SELECT
  vals.limit_id::uuid,
  p.id,
  vals.metric_key,
  vals.metric_limit,
  vals.reset_period
FROM (
  VALUES
    ('0f0466c4-cce8-4120-bef0-e3568a86523f', 'free', 'domains.total', 1, 'lifetime'),
    ('5cf66d88-615d-4cec-8ec8-4ceb1f8ddb6f', 'free', 'storage.used', 500, 'lifetime'),
    ('5f36db84-389f-4df2-8cc3-df6d4e59495e', 'free', 'api_calls.monthly', 10000, 'monthly'),
    ('eb3735a7-cf65-41d7-82d8-93f48f2e76ec', 'free', 'webhooks.monthly', 1000, 'monthly'),
    ('76553fd8-b7f9-4f34-ae8e-79cdf0744ea6', 'pro', 'domains.total', 3, 'lifetime'),
    ('4f71f87f-4990-4de5-ae67-c6f5c3f8e4d2', 'pro', 'storage.used', 5000, 'lifetime'),
    ('3d50ddb3-e204-4b13-a6d0-0f87eb086cf4', 'pro', 'api_calls.monthly', 100000, 'monthly'),
    ('26f2b8b6-9ef0-45f4-b2f2-c3d30ecc45b2', 'pro', 'webhooks.monthly', 10000, 'monthly'),
    ('77ce2e4c-1432-4f9f-9dfd-90587f6ec108', 'business', 'domains.total', 10, 'lifetime'),
    ('ad6f73d7-9ad7-43f2-9f99-3d17c95a7b73', 'business', 'storage.used', 50000, 'lifetime'),
    ('b63f1277-2e89-4721-a532-fdb40e0f40ef', 'business', 'api_calls.monthly', NULL, 'monthly'),
    ('4f9565bb-4b65-4f5d-b3f2-f68b1b1366f2', 'business', 'webhooks.monthly', NULL, 'monthly')
) AS vals(limit_id, plan_code, metric_key, metric_limit, reset_period)
JOIN plans p ON LOWER(p.code) = LOWER(vals.plan_code)
ON CONFLICT (plan_id, metric_key) DO UPDATE
SET metric_limit = EXCLUDED.metric_limit,
    reset_period = EXCLUDED.reset_period,
    updated_at = NOW();

INSERT INTO plan_entitlements (id, plan_id, feature_key, is_enabled)
SELECT
  vals.entitlement_id::uuid,
  p.id,
  vals.feature_key,
  vals.is_enabled
FROM (
  VALUES
    ('3dedbe56-6cb6-42f5-bda0-401f3f72dd74', 'free', 'custom_domains', TRUE),
    ('75cde15d-9f24-4f17-b50b-b64f6ab64171', 'free', 'advanced_promotions', FALSE),
    ('3d01532f-7969-4cee-8588-b129f2ac3f5e', 'free', 'priority_support', FALSE),
    ('d51d2ef6-dd5c-4cdf-b3ba-301c52e6e054', 'free', 'advanced_analytics', FALSE),
    ('4df7788e-0628-4e75-8f89-0fb7f13f12d5', 'free', 'api_access', TRUE),
    ('7cf7246e-f770-4d8c-8b97-f3d64220f6f4', 'free', 'webhooks_access', TRUE),
    ('e1a6c2ad-ad64-426d-ab0f-186352739168', 'free', 'staff_management', TRUE),
    ('71af97ea-3234-427b-9230-45ddf4b6904d', 'free', 'affiliate_program', FALSE),
    ('c4c17fd6-ca02-46bb-a0c4-c4e4f28342e1', 'free', 'loyalty_program', FALSE),
    ('de03b836-d1e5-4e5f-aa99-4f1b2295c5e4', 'pro', 'custom_domains', TRUE),
    ('31ecba4e-a0c5-4a8d-8488-9e079e1574ff', 'pro', 'advanced_promotions', TRUE),
    ('8cc7cb62-6993-44d6-89e6-a1a5d6889b15', 'pro', 'priority_support', FALSE),
    ('f85e4926-cf44-4f0d-940d-dd8ecd4ef2e9', 'pro', 'advanced_analytics', TRUE),
    ('3f45c7d2-6347-48d2-b5b8-eefb59fb797a', 'pro', 'api_access', TRUE),
    ('1ca49880-f931-4c98-8f95-513fe4892f0a', 'pro', 'webhooks_access', TRUE),
    ('67d8a6ad-e017-4f4f-8774-71a1dcf4ff09', 'pro', 'staff_management', TRUE),
    ('9d7af188-cb03-4ee6-8f71-8c3859f1f631', 'pro', 'affiliate_program', TRUE),
    ('60cfbd8f-1a68-4f47-88fd-cf6d516f6f47', 'pro', 'loyalty_program', TRUE),
    ('0d69ec7f-ab4c-4ffa-a793-4b9ff8ca5de1', 'business', 'custom_domains', TRUE),
    ('7d3a9d89-4e50-4ac0-8fa6-a55ef5f12d4d', 'business', 'advanced_promotions', TRUE),
    ('715dbb3c-51a8-44fe-b4ff-abd5eb52fa2e', 'business', 'priority_support', TRUE),
    ('8cf34d84-7d17-475e-8cf7-e6d1f28245d0', 'business', 'advanced_analytics', TRUE),
    ('87ffbdd2-6cd8-4140-b603-c8a40e96a95d', 'business', 'api_access', TRUE),
    ('59a27f9b-f32a-4d7e-a70d-a24788b8ebca', 'business', 'webhooks_access', TRUE),
    ('5f5bfe04-1137-4f95-90d8-f0574b1ea090', 'business', 'staff_management', TRUE),
    ('f83945f5-ddbe-4cb8-bfaa-f2ccd722e364', 'business', 'affiliate_program', TRUE),
    ('97d04295-79e6-4f83-8d93-b8986fbd8d55', 'business', 'loyalty_program', TRUE)
) AS vals(entitlement_id, plan_code, feature_key, is_enabled)
JOIN plans p ON LOWER(p.code) = LOWER(vals.plan_code)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();
