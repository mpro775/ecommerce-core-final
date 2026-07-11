ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_code_unique
  ON plans (LOWER(code));

CREATE TABLE IF NOT EXISTS plan_limits (
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_limit INTEGER,
  reset_period TEXT NOT NULL CHECK (reset_period IN ('lifetime', 'monthly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_limits_plan_metric_unique
  ON plan_limits (plan_id, metric_key);

CREATE TABLE IF NOT EXISTS store_subscriptions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended')),
  starts_at TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_store_status
  ON store_subscriptions (store_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_subscriptions_one_current
  ON store_subscriptions (store_id)
  WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_usage_events_store_metric_time
  ON usage_events (store_id, metric_key, happened_at DESC);

INSERT INTO plans (id, code, name, description, is_active)
VALUES
  ('0fb1c56d-6372-4d93-9627-a4b53b4f89f2', 'free', 'Free', 'Starter plan with strict limits', TRUE),
  ('fce98927-7025-4a66-b9d1-70f4ce7ae2d2', 'pro', 'Pro', 'Growth plan for active stores', TRUE),
  ('6b31c5f3-f98b-4ad6-bdd3-b1f3f0d4f5db', 'business', 'Business', 'Advanced plan with high limits', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO plan_limits (id, plan_id, metric_key, metric_limit, reset_period)
SELECT
  values_table.limit_id::uuid,
  p.id,
  values_table.metric_key,
  values_table.metric_limit,
  values_table.reset_period
FROM (
  VALUES
    ('8df6fbc0-94a9-4d23-b122-54af3770f45a', 'free', 'products.total', 100, 'lifetime'),
    ('ec9a8534-1988-4a95-8f95-0b9ad61f17a4', 'free', 'orders.monthly', 100, 'monthly'),
    ('9fdab718-2fce-4e71-b390-b6f5cab68357', 'free', 'staff.total', 1, 'lifetime'),
    ('35140110-3fd3-4f5c-89f2-87f51f05fa39', 'pro', 'products.total', 1000, 'lifetime'),
    ('0bbeb117-7a2a-4213-b817-f96f16f8e0dd', 'pro', 'orders.monthly', 2000, 'monthly'),
    ('6f617ad3-04cd-4c4a-8f15-2f9309224f22', 'pro', 'staff.total', 5, 'lifetime'),
    ('c3cc6955-6f00-4e62-a6e9-e0af65537846', 'business', 'products.total', NULL, 'lifetime'),
    ('ce455f9c-8b5e-4b1d-8f31-d9577ef79e6f', 'business', 'orders.monthly', NULL, 'monthly'),
    ('8d57f913-f7f3-4cc0-b7ce-3563f4192f17', 'business', 'staff.total', 50, 'lifetime')
) AS values_table(limit_id, plan_code, metric_key, metric_limit, reset_period)
JOIN plans p ON LOWER(p.code) = LOWER(values_table.plan_code)
ON CONFLICT (plan_id, metric_key) DO UPDATE
SET metric_limit = EXCLUDED.metric_limit,
    reset_period = EXCLUDED.reset_period,
    updated_at = NOW();
