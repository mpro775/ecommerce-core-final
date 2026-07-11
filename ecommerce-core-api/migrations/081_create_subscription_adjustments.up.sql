CREATE TABLE IF NOT EXISTS subscription_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES store_subscriptions(id) ON DELETE CASCADE,
  invoice_id UUID NULL REFERENCES subscription_invoices(id) ON DELETE SET NULL,
  operation VARCHAR(50) NOT NULL,
  accounting_category VARCHAR(50) NOT NULL,
  affects_revenue BOOLEAN NOT NULL DEFAULT FALSE,
  amount NUMERIC(14, 2) NULL,
  currency_code CHAR(3) NULL,
  days_delta INTEGER NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NULL,
  old_billing_cycle VARCHAR(20) NULL,
  new_billing_cycle VARCHAR(20) NULL,
  old_current_period_end TIMESTAMPTZ NULL,
  new_current_period_end TIMESTAMPTZ NULL,
  old_next_billing_at TIMESTAMPTZ NULL,
  new_next_billing_at TIMESTAMPTZ NULL,
  old_trial_ends_at TIMESTAMPTZ NULL,
  new_trial_ends_at TIMESTAMPTZ NULL,
  reason VARCHAR(255) NOT NULL,
  note TEXT NULL,
  created_by_admin_id UUID NULL REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_subscription_adjustments_operation CHECK (operation IN (
    'extend_period',
    'reduce_period',
    'set_period_end',
    'set_next_billing_at',
    'grant_trial_days',
    'clear_trial',
    'set_status',
    'suspend',
    'resume',
    'cancel',
    'reset_billing_cycle',
    'mark_paid_until',
    'manual_correction',
    'compensation',
    'marketing_gift'
  )),
  CONSTRAINT chk_subscription_adjustments_accounting_category CHECK (accounting_category IN (
    'revenue',
    'marketing_gift',
    'trial',
    'coupon_discount',
    'compensation',
    'manual_adjustment',
    'internal_test'
  )),
  CONSTRAINT chk_subscription_adjustments_currency_code CHECK (
    currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT chk_subscription_adjustments_revenue_amount CHECK (
    accounting_category <> 'revenue'
    OR (affects_revenue = TRUE AND amount IS NOT NULL AND currency_code IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_store_id
  ON subscription_adjustments(store_id);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_subscription_id
  ON subscription_adjustments(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_operation
  ON subscription_adjustments(operation);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_accounting_category
  ON subscription_adjustments(accounting_category);

CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_created_at
  ON subscription_adjustments(created_at DESC);
