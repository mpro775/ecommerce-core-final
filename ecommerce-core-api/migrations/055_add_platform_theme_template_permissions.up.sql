INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('968dbe1e-23a6-4c17-b79b-6f4a92981e6a', 'platform.theme_templates.read', 'View platform theme template catalog'),
  ('f46e20ef-2052-45ca-b8f6-c6ee8b70d04f', 'platform.theme_templates.write', 'Create and edit platform theme templates'),
  ('cf90ee5c-9633-4d5a-9557-9c2da6b4bfa4', 'platform.theme_templates.publish', 'Publish platform theme templates to merchants'),
  ('f89fc404-1285-4c7f-a61f-86b8a7c4f4d3', 'platform.theme_templates.archive', 'Archive platform theme templates')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN (
    'platform.theme_templates.read',
    'platform.theme_templates.write',
    'platform.theme_templates.publish',
    'platform.theme_templates.archive'
  )
WHERE LOWER(r.code) IN ('super_admin', 'ops_manager')
ON CONFLICT DO NOTHING;
