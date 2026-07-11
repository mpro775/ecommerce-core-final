DELETE FROM theme_template_versions;
DELETE FROM theme_templates WHERE template_key IN ('general-starter', 'fashion-editorial');

ALTER TABLE theme_templates DROP CONSTRAINT IF EXISTS theme_templates_renderer_type_check;
ALTER TABLE theme_templates
  DROP COLUMN IF EXISTS renderer_type,
  DROP COLUMN IF EXISTS component_key,
  DROP COLUMN IF EXISTS allowed_plans,
  DROP COLUMN IF EXISTS assets,
  DROP COLUMN IF EXISTS settings_schema,
  DROP COLUMN IF EXISTS default_config,
  DROP COLUMN IF EXISTS capabilities,
  DROP COLUMN IF EXISTS min_storefront_version;

ALTER TABLE theme_template_versions
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS config_snapshot,
  DROP COLUMN IF EXISTS settings_schema_snapshot,
  DROP COLUMN IF EXISTS assets_snapshot,
  DROP COLUMN IF EXISTS capabilities_snapshot,
  DROP COLUMN IF EXISTS changelog;
