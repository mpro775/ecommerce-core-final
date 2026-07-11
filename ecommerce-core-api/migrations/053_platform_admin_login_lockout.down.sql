DROP INDEX IF EXISTS idx_platform_admin_users_locked_until;

ALTER TABLE platform_admin_users
  DROP COLUMN IF EXISTS last_failed_login_at,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_login_attempts;
