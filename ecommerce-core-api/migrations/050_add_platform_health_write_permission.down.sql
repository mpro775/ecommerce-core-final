DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id
  FROM platform_admin_permissions
  WHERE key = 'platform.health.write'
);

DELETE FROM platform_admin_permissions
WHERE key = 'platform.health.write';

