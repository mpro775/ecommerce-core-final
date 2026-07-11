ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_discount_type_check;

ALTER TABLE subscription_coupons
  ADD CONSTRAINT subscription_coupons_discount_type_check
  CHECK (discount_type IN ('percent', 'fixed', 'free_days', 'free_months', 'activate_plan'));

ALTER TABLE subscription_coupons
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'discount',
  ADD COLUMN IF NOT EXISTS accounting_category TEXT NOT NULL DEFAULT 'coupon_discount',
  ADD COLUMN IF NOT EXISTS affects_revenue BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS activate_plan_code TEXT;

ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_purpose_check,
  ADD CONSTRAINT subscription_coupons_purpose_check
    CHECK (purpose IN ('discount', 'activation', 'retention', 'compensation', 'trial'));

ALTER TABLE subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_accounting_category_check,
  ADD CONSTRAINT subscription_coupons_accounting_category_check
    CHECK (accounting_category IN ('revenue', 'marketing_gift', 'trial', 'coupon_discount', 'compensation', 'manual_adjustment', 'internal_test'));

CREATE TABLE IF NOT EXISTS subscription_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID NULL REFERENCES store_subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
  payment_id UUID NULL REFERENCES subscription_payments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  payment_method_id UUID NULL,
  payment_method_code TEXT NULL,
  payment_method_name TEXT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'YER',
  transaction_reference TEXT NULL,
  paid_at TIMESTAMPTZ NULL,
  receipt_media_id UUID NULL REFERENCES media_assets(id) ON DELETE SET NULL,
  receipt_url TEXT NULL,
  receipt_file_name TEXT NULL,
  receipt_mime_type TEXT NULL,
  receipt_size_bytes BIGINT NULL,
  merchant_note TEXT NULL,
  admin_note TEXT NULL,
  rejection_reason TEXT NULL,
  reviewed_by_admin_id UUID NULL REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL REFERENCES store_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subscription_payment_receipts_amount_check CHECK (amount > 0),
  CONSTRAINT subscription_payment_receipts_status_check CHECK (status IN ('pending_review', 'approved', 'rejected', 'canceled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payment_receipts_one_approved_invoice
  ON subscription_payment_receipts(invoice_id)
  WHERE status = 'approved' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_payment_receipts_store_id
  ON subscription_payment_receipts(store_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payment_receipts_invoice_id
  ON subscription_payment_receipts(invoice_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payment_receipts_status
  ON subscription_payment_receipts(status);

CREATE INDEX IF NOT EXISTS idx_subscription_payment_receipts_created_at
  ON subscription_payment_receipts(created_at DESC);
