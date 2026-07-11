CREATE TABLE IF NOT EXISTS theme_versions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES store_themes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  published_by UUID,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_versions_store_version_unique
  ON theme_versions (store_id, version);

CREATE INDEX IF NOT EXISTS idx_theme_versions_store_published
  ON theme_versions (store_id, published_at DESC);
