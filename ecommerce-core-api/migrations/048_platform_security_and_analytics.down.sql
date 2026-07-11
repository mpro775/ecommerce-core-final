ALTER TABLE platform_admin_users
  DROP COLUMN IF EXISTS trusted_user_agents,
  DROP COLUMN IF EXISTS trusted_ips,
  DROP COLUMN IF EXISTS mfa_backup_codes,
  DROP COLUMN IF EXISTS mfa_secret,
  DROP COLUMN IF EXISTS mfa_enabled;

DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id FROM platform_admin_permissions WHERE key = 'platform.analytics.read'
);

DELETE FROM platform_admin_permissions
WHERE key = 'platform.analytics.read';
