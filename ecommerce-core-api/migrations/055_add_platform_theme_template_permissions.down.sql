DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id
  FROM platform_admin_permissions
  WHERE key IN (
    'platform.theme_templates.read',
    'platform.theme_templates.write',
    'platform.theme_templates.publish',
    'platform.theme_templates.archive'
  )
);

DELETE FROM platform_admin_permissions
WHERE key IN (
  'platform.theme_templates.read',
  'platform.theme_templates.write',
  'platform.theme_templates.publish',
  'platform.theme_templates.archive'
);
