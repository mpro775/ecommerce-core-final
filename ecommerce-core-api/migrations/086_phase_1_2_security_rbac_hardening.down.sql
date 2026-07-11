DROP INDEX IF EXISTS idx_warehouse_inventory_warehouse_variant;
DROP INDEX IF EXISTS idx_product_categories_category_id;
DROP INDEX IF EXISTS idx_customers_store_email_not_null;
DROP INDEX IF EXISTS idx_platform_admin_roles_code_lower_unique;
DROP INDEX IF EXISTS idx_customer_sessions_customer_revoked;
DROP INDEX IF EXISTS idx_sessions_user_revoked;
DROP INDEX IF EXISTS idx_platform_admin_sessions_admin_revoked;
DROP INDEX IF EXISTS idx_customer_password_resets_token_hash;
DROP INDEX IF EXISTS idx_customer_password_resets_token_hash_unique;
DROP INDEX IF EXISTS idx_password_resets_token_hash_unique;
DROP INDEX IF EXISTS idx_audit_logs_customer;
DROP INDEX IF EXISTS idx_audit_logs_platform_admin;
DROP INDEX IF EXISTS idx_audit_logs_actor;
DROP INDEX IF EXISTS idx_audit_logs_created_at;

ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS after_snapshot,
  DROP COLUMN IF EXISTS before_snapshot,
  DROP COLUMN IF EXISTS severity,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS customer_id,
  DROP COLUMN IF EXISTS platform_admin_id,
  DROP COLUMN IF EXISTS actor_id,
  DROP COLUMN IF EXISTS actor_type;
