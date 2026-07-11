ALTER TABLE plans
  ALTER COLUMN currency_code SET DEFAULT 'YER';

ALTER TABLE subscription_coupons
  ALTER COLUMN currency_code SET DEFAULT 'YER';

ALTER TABLE subscription_payment_receipts
  ALTER COLUMN currency_code SET DEFAULT 'YER';

UPDATE plans
SET currency_code = 'YER'
WHERE COALESCE(currency_code, '') <> 'YER';

UPDATE subscription_invoices
SET currency_code = 'YER'
WHERE COALESCE(currency_code, '') <> 'YER';

UPDATE subscription_payments
SET currency_code = 'YER'
WHERE COALESCE(currency_code, '') <> 'YER';

UPDATE subscription_coupons
SET currency_code = 'YER'
WHERE COALESCE(currency_code, '') <> 'YER';

UPDATE subscription_payment_receipts
SET currency_code = 'YER'
WHERE COALESCE(currency_code, '') <> 'YER';

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payment_receipts_one_pending_invoice
  ON subscription_payment_receipts(invoice_id)
  WHERE status = 'pending_review' AND deleted_at IS NULL;

ALTER TABLE subscription_payment_receipts
  DROP CONSTRAINT IF EXISTS subscription_payment_receipts_receipt_source_check,
  ADD CONSTRAINT subscription_payment_receipts_receipt_source_check
    CHECK (receipt_media_id IS NOT NULL OR NULLIF(BTRIM(receipt_url), '') IS NOT NULL);

ALTER TABLE subscription_payment_receipts
  DROP CONSTRAINT IF EXISTS subscription_payment_receipts_currency_yer_check,
  ADD CONSTRAINT subscription_payment_receipts_currency_yer_check
    CHECK (currency_code = 'YER');

ALTER TABLE subscription_invoices
  DROP CONSTRAINT IF EXISTS subscription_invoices_currency_yer_check,
  ADD CONSTRAINT subscription_invoices_currency_yer_check
    CHECK (currency_code = 'YER');

ALTER TABLE subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_currency_yer_check,
  ADD CONSTRAINT subscription_payments_currency_yer_check
    CHECK (currency_code = 'YER');

ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_currency_yer_check,
  ADD CONSTRAINT subscription_coupons_currency_yer_check
    CHECK (currency_code = 'YER');

ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_activate_plan_requires_plan_check,
  ADD CONSTRAINT subscription_coupons_activate_plan_requires_plan_check
    CHECK (discount_type <> 'activate_plan' OR NULLIF(BTRIM(activate_plan_code), '') IS NOT NULL);
