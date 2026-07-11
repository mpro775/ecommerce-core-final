ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE notifications
SET severity = COALESCE(severity, 'info'),
    source = COALESCE(source, 'system')
WHERE severity IS NULL
   OR source IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_store_category_created
  ON notifications (store_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_store_severity_created
  ON notifications (store_id, severity, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications (store_id, recipient_type, type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
