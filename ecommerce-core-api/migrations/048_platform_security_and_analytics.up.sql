ALTER TABLE platform_admin_users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
  ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trusted_ips JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trusted_user_agents JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('40a799bc-fde2-4f43-a7af-6082bbf2c401', 'platform.analytics.read', 'Read platform advanced analytics')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN ('platform.analytics.read')
WHERE LOWER(r.code) IN ('super_admin', 'ops_manager', 'finance_admin', 'auditor')
ON CONFLICT DO NOTHING;
