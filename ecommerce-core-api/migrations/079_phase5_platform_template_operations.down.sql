DROP INDEX IF EXISTS idx_theme_templates_search;
DROP INDEX IF EXISTS idx_theme_templates_production_status;

ALTER TABLE theme_templates
  DROP CONSTRAINT IF EXISTS theme_templates_category_check,
  ADD CONSTRAINT theme_templates_category_check CHECK (
    category IN ('fashion', 'electronics', 'beauty', 'grocery', 'luxury', 'minimal', 'restaurant', 'general')
  );

ALTER TABLE theme_template_versions
  DROP COLUMN IF EXISTS changelog_description,
  DROP COLUMN IF EXISTS changelog_title;

ALTER TABLE theme_templates
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS last_production_check_at,
  DROP COLUMN IF EXISTS last_validated_at,
  DROP COLUMN IF EXISTS changelog_entries;
