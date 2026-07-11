DROP INDEX IF EXISTS idx_store_domains_cloudflare_hostname_id;
DROP INDEX IF EXISTS idx_store_domains_ssl_provider_status;

ALTER TABLE store_domains
  DROP COLUMN IF EXISTS ssl_error,
  DROP COLUMN IF EXISTS ssl_last_checked_at,
  DROP COLUMN IF EXISTS cloudflare_hostname_id,
  DROP COLUMN IF EXISTS cloudflare_zone_id,
  DROP COLUMN IF EXISTS ssl_mode,
  DROP COLUMN IF EXISTS ssl_provider;
