ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS before_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS after_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_type, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_platform_admin
  ON audit_logs (platform_admin_id, created_at DESC)
  WHERE platform_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_customer
  ON audit_logs (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_resets_token_hash_unique
  ON password_resets (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_password_resets_token_hash_unique
  ON customer_password_resets (token_hash);

CREATE INDEX IF NOT EXISTS idx_customer_password_resets_token_hash
  ON customer_password_resets (token_hash);

CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_admin_revoked
  ON platform_admin_sessions (admin_user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_revoked
  ON sessions (store_user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer_revoked
  ON customer_sessions (customer_id, revoked_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_roles_code_lower_unique
  ON platform_admin_roles (LOWER(code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email_not_null
  ON customers (store_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_category_id
  ON product_categories (category_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse_variant
  ON warehouse_inventory (warehouse_id, variant_id);
