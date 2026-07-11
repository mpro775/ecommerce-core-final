ALTER TABLE theme_templates
  ADD COLUMN IF NOT EXISTS changelog_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_production_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE theme_template_versions
  ADD COLUMN IF NOT EXISTS changelog_title TEXT,
  ADD COLUMN IF NOT EXISTS changelog_description TEXT;

ALTER TABLE theme_templates
  DROP CONSTRAINT IF EXISTS theme_templates_category_check,
  ADD CONSTRAINT theme_templates_category_check CHECK (
    category IN (
      'general',
      'electronics',
      'beauty',
      'fashion',
      'grocery',
      'home',
      'restaurant',
      'services',
      'other',
      'luxury',
      'minimal'
    )
  );

CREATE INDEX IF NOT EXISTS idx_theme_templates_production_status
  ON theme_templates ((COALESCE(capabilities #>> '{production,status}', 'experimental')));

CREATE INDEX IF NOT EXISTS idx_theme_templates_search
  ON theme_templates USING gin (
    to_tsvector('simple', COALESCE(template_key, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(description, ''))
  );
