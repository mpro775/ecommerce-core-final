DROP INDEX IF EXISTS idx_billing_events_store_created;
DROP INDEX IF EXISTS idx_billing_events_source_idempotency_unique;
DROP TABLE IF EXISTS billing_events;

DROP INDEX IF EXISTS idx_subscription_payments_store_created;
DROP INDEX IF EXISTS idx_subscription_payments_invoice;
DROP TABLE IF EXISTS subscription_payments;

DROP INDEX IF EXISTS idx_subscription_invoices_subscription_status;
DROP INDEX IF EXISTS idx_subscription_invoices_store_created;
DROP INDEX IF EXISTS idx_subscription_invoices_invoice_number_unique;
DROP TABLE IF EXISTS subscription_invoices;

ALTER TABLE store_subscriptions
  DROP COLUMN IF EXISTS provider_subscription_id,
  DROP COLUMN IF EXISTS provider_customer_id,
  DROP COLUMN IF EXISTS next_billing_at,
  DROP COLUMN IF EXISTS canceled_at,
  DROP COLUMN IF EXISTS cancel_at_period_end,
  DROP COLUMN IF EXISTS billing_cycle;

DROP INDEX IF EXISTS idx_plan_entitlements_plan_feature_unique;
DROP TABLE IF EXISTS plan_entitlements;

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_billing_cycle_options_non_empty,
  DROP CONSTRAINT IF EXISTS plans_trial_days_default_non_negative,
  DROP CONSTRAINT IF EXISTS plans_annual_price_non_negative,
  DROP CONSTRAINT IF EXISTS plans_monthly_price_non_negative;

ALTER TABLE plans
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS trial_days_default,
  DROP COLUMN IF EXISTS billing_cycle_options,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS annual_price,
  DROP COLUMN IF EXISTS monthly_price;
