INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('0f5f7f7c-b751-40d5-a4dc-c947d79a4f01', 'platform.health.write', 'Manage platform incidents')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key = 'platform.health.write'
WHERE LOWER(r.code) IN ('super_admin', 'ops_manager')
ON CONFLICT DO NOTHING;

