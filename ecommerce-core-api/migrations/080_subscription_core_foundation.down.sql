DROP INDEX IF EXISTS idx_subscription_invoices_status_due;
DROP INDEX IF EXISTS idx_store_subscriptions_status_current;
DROP INDEX IF EXISTS idx_store_subscriptions_one_current;

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_billing_cycle_options_values_check,
  DROP CONSTRAINT IF EXISTS plans_currency_code_check;

ALTER TABLE subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_status_check,
  ADD CONSTRAINT subscription_payments_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'));

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_billing_cycle_check,
  ADD CONSTRAINT subscription_invoices_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'annual', 'proration', 'manual'));

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_status_check,
  ADD CONSTRAINT subscription_invoices_status_check
  CHECK (status IN ('draft', 'open', 'paid', 'failed', 'void'));

ALTER TABLE store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_billing_cycle_check,
  ADD CONSTRAINT store_subscriptions_billing_cycle_check
  CHECK (billing_cycle IN ('monthly', 'annual', 'manual'));

ALTER TABLE store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_status_check,
  ADD CONSTRAINT store_subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended'));
