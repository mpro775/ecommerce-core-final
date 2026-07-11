ALTER TABLE store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_status_check;

ALTER TABLE store_subscriptions
  ADD CONSTRAINT store_subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired'));

ALTER TABLE store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_billing_cycle_check;

ALTER TABLE store_subscriptions
  ADD CONSTRAINT store_subscriptions_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'annual', 'manual'));

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_status_check;

ALTER TABLE subscription_invoices
  ADD CONSTRAINT subscription_invoices_status_check
  CHECK (status IN ('draft', 'open', 'paid', 'failed', 'void', 'refunded'));

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_billing_cycle_check;

ALTER TABLE subscription_invoices
  ADD CONSTRAINT subscription_invoices_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'annual', 'proration', 'manual'));

ALTER TABLE subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_status_check;

ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'));

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_currency_code_check,
  ADD CONSTRAINT plans_currency_code_check
    CHECK (currency_code ~ '^[A-Z]{3}$');

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_billing_cycle_options_values_check,
  ADD CONSTRAINT plans_billing_cycle_options_values_check
    CHECK (billing_cycle_options <@ ARRAY['monthly', 'annual']::text[]);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM store_subscriptions
    WHERE is_current = TRUE
    GROUP BY store_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_store_subscriptions_one_current
      ON store_subscriptions (store_id)
      WHERE is_current = TRUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_subscriptions_status_current
  ON store_subscriptions (status, current_period_end)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status_due
  ON subscription_invoices (status, due_at);
