DROP INDEX IF EXISTS idx_store_domains_support_required;
DROP INDEX IF EXISTS idx_store_domains_dns_check;

ALTER TABLE store_domains
  DROP COLUMN IF EXISTS technical_error_message,
  DROP COLUMN IF EXISTS technical_error_code,
  DROP COLUMN IF EXISTS support_required,
  DROP COLUMN IF EXISTS setup_step,
  DROP COLUMN IF EXISTS last_cloudflare_sync_at,
  DROP COLUMN IF EXISTS last_dns_check_result,
  DROP COLUMN IF EXISTS last_dns_check_at,
  DROP COLUMN IF EXISTS ownership_verification,
  DROP COLUMN IF EXISTS ssl_validation_records;
