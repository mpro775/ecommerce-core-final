DROP TABLE IF EXISTS owner_registration_challenges;

DROP INDEX IF EXISTS idx_store_deletion_purge_jobs_status;
DROP TABLE IF EXISTS store_deletion_purge_jobs;

DROP INDEX IF EXISTS idx_stores_deleted_at;
DROP INDEX IF EXISTS idx_stores_purge_status;

UPDATE stores
SET status = 'active'
WHERE status = 'deleted';

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_status_check,
  DROP CONSTRAINT IF EXISTS stores_purge_status_check;

ALTER TABLE stores
  ADD CONSTRAINT stores_status_check
    CHECK (status IN ('active', 'suspended'));

ALTER TABLE stores
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by_platform_admin_id,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS purge_status,
  DROP COLUMN IF EXISTS purge_started_at,
  DROP COLUMN IF EXISTS purge_completed_at,
  DROP COLUMN IF EXISTS purge_error;

ALTER TABLE store_users
  DROP COLUMN IF EXISTS anonymized_at,
  DROP COLUMN IF EXISTS original_email_hash;

UPDATE audit_logs
SET actor_type = 'system',
    actor_id = NULL
WHERE actor_type = 'platform_admin';

DROP INDEX IF EXISTS idx_audit_logs_platform_admin;

ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS platform_admin_id;

DELETE FROM notifications
WHERE recipient_type = 'platform';

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_recipient_type_check
    CHECK (recipient_type IN ('store', 'store_user', 'customer'));
