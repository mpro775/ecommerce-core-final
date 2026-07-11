CREATE TABLE IF NOT EXISTS store_themes (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_themes_store_id
  ON store_themes (store_id);

CREATE TABLE IF NOT EXISTS theme_preview_tokens (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_preview_tokens_store_expires
  ON theme_preview_tokens (store_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS store_domains (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'active')),
  ssl_status TEXT NOT NULL CHECK (ssl_status IN ('pending', 'requested', 'issued', 'error')),
  verified_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_domains_hostname_unique
  ON store_domains (LOWER(hostname));

CREATE INDEX IF NOT EXISTS idx_store_domains_store_status
  ON store_domains (store_id, status);
