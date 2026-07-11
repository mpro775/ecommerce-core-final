ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_activate_plan_requires_plan_check,
  DROP CONSTRAINT IF EXISTS subscription_coupons_currency_yer_check;

ALTER TABLE subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_currency_yer_check;

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_currency_yer_check;

ALTER TABLE subscription_payment_receipts
  DROP CONSTRAINT IF EXISTS subscription_payment_receipts_currency_yer_check,
  DROP CONSTRAINT IF EXISTS subscription_payment_receipts_receipt_source_check;

DROP INDEX IF EXISTS idx_subscription_payment_receipts_one_pending_invoice;
