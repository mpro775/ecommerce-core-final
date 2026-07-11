DROP INDEX IF EXISTS idx_payments_receipt_media;
DROP INDEX IF EXISTS idx_payments_status;

ALTER TABLE payments
  DROP COLUMN IF EXISTS customer_uploaded_at,
  DROP COLUMN IF EXISTS receipt_media_asset_id,
  DROP COLUMN IF EXISTS review_note,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at;
