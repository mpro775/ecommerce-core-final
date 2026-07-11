CREATE TABLE IF NOT EXISTS theme_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_image_url TEXT,
  preview_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  suitable_for TEXT NOT NULL DEFAULT '',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  required_plan TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  version INTEGER NOT NULL DEFAULT 1,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  published_by UUID,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT theme_templates_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT theme_templates_category_check CHECK (
    category IN ('fashion', 'electronics', 'beauty', 'grocery', 'luxury', 'minimal', 'restaurant', 'general')
  ),
  CONSTRAINT theme_templates_required_plan_check CHECK (required_plan IS NULL OR length(trim(required_plan)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_theme_templates_status_category
  ON theme_templates(status, category);

CREATE TABLE IF NOT EXISTS theme_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES theme_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

