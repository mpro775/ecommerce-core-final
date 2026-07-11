DROP INDEX IF EXISTS idx_notifications_dedupe;
DROP INDEX IF EXISTS idx_notifications_store_severity_created;
DROP INDEX IF EXISTS idx_notifications_store_category_created;

ALTER TABLE notifications
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS dedupe_key,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS severity,
  DROP COLUMN IF EXISTS category;
