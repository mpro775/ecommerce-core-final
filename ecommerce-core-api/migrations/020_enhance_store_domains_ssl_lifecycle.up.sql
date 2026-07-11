ALTER TABLE store_domains
  ADD COLUMN IF NOT EXISTS ssl_provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (ssl_provider IN ('manual', 'cloudflare')),
  ADD COLUMN IF NOT EXISTS ssl_mode TEXT NOT NULL DEFAULT 'full_strict'
    CHECK (ssl_mode IN ('full', 'full_strict')),
  ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT,
  ADD COLUMN IF NOT EXISTS cloudflare_hostname_id TEXT,
  ADD COLUMN IF NOT EXISTS ssl_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ssl_error TEXT;

UPDATE store_domains
SET ssl_provider = 'manual',
    ssl_mode = 'full_strict'
WHERE ssl_provider IS NULL
   OR ssl_mode IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_domains_ssl_provider_status
  ON store_domains (ssl_provider, ssl_status);

CREATE INDEX IF NOT EXISTS idx_store_domains_cloudflare_hostname_id
  ON store_domains (cloudflare_hostname_id)
  WHERE cloudflare_hostname_id IS NOT NULL;
