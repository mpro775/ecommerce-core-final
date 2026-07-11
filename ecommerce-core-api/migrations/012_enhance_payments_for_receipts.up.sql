ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS receipt_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (store_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_receipt_media
  ON payments (receipt_media_asset_id);
