ALTER TABLE store_domains
  ADD COLUMN IF NOT EXISTS ssl_validation_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ownership_verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_dns_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dns_check_result JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_cloudflare_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_step TEXT,
  ADD COLUMN IF NOT EXISTS support_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS technical_error_code TEXT,
  ADD COLUMN IF NOT EXISTS technical_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_store_domains_dns_check
  ON store_domains (last_dns_check_at DESC)
  WHERE last_dns_check_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_domains_support_required
  ON store_domains (support_required, updated_at DESC)
  WHERE support_required = true;
