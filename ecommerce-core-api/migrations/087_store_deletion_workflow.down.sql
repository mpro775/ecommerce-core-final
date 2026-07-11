DELETE FROM platform_admin_role_permissions rp
USING platform_admin_permissions p
WHERE rp.permission_id = p.id
  AND p.key IN (
    'platform.stores.delete.preview',
    'platform.stores.delete.confirm',
    'platform.stores.delete.status',
    'platform.stores.purge.retry'
  );

DELETE FROM platform_admin_permissions
WHERE key IN (
  'platform.stores.delete.preview',
  'platform.stores.delete.confirm',
  'platform.stores.delete.status',
  'platform.stores.purge.retry'
);

DROP INDEX IF EXISTS idx_store_deletion_purge_jobs_status;
DROP TABLE IF EXISTS store_deletion_purge_jobs;

ALTER TABLE store_domains
  DROP CONSTRAINT IF EXISTS store_domains_status_check;

ALTER TABLE store_domains
  ADD CONSTRAINT store_domains_status_check
    CHECK (status IN ('pending', 'verified', 'active'));

DROP INDEX IF EXISTS idx_store_users_deleted_at;
DROP INDEX IF EXISTS idx_stores_purge_status;
DROP INDEX IF EXISTS idx_stores_deleted_at;
DROP INDEX IF EXISTS idx_stores_status;
DROP INDEX IF EXISTS uniq_store_users_active_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_users_email_unique
  ON store_users (LOWER(email));

ALTER TABLE store_users
  DROP COLUMN IF EXISTS original_email_hash,
  DROP COLUMN IF EXISTS anonymized_at,
  DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_purge_status_check,
  DROP CONSTRAINT IF EXISTS stores_status_check;

ALTER TABLE stores
  DROP COLUMN IF EXISTS purge_error,
  DROP COLUMN IF EXISTS purge_completed_at,
  DROP COLUMN IF EXISTS purge_started_at,
  DROP COLUMN IF EXISTS purge_status,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS deleted_by_platform_admin_id,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS status;
