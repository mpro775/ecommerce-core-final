DROP INDEX IF EXISTS idx_payments_expiration_claim;
ALTER TABLE payments
  DROP COLUMN IF EXISTS collection_reference,
  DROP COLUMN IF EXISTS collected_at,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS review_started_at,
  DROP COLUMN IF EXISTS submission_version,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS refunded_amount,
  DROP COLUMN IF EXISTS paid_amount;

DROP INDEX IF EXISTS idx_orders_store_lifecycle;
ALTER TABLE orders
  DROP COLUMN IF EXISTS refunded_amount,
  DROP COLUMN IF EXISTS paid_amount,
  DROP COLUMN IF EXISTS tax_amount,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS legacy_return_note,
  DROP COLUMN IF EXISTS legacy_returned_at,
  DROP COLUMN IF EXISTS version;
