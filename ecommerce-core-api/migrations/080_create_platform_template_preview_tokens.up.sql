CREATE TABLE IF NOT EXISTS platform_theme_template_preview_tokens (
  id UUID PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  template_id UUID NOT NULL REFERENCES theme_templates(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  config_snapshot JSONB NOT NULL,
  settings_schema_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  assets_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_template_preview_tokens_token_expires
  ON platform_theme_template_preview_tokens (token, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_template_preview_tokens_template
  ON platform_theme_template_preview_tokens (template_id, expires_at DESC);
