DROP INDEX IF EXISTS idx_customer_password_resets_customer;
DROP TABLE IF EXISTS customer_password_resets;

DROP INDEX IF EXISTS idx_customer_sessions_store;
DROP INDEX IF EXISTS idx_customer_sessions_customer;
DROP TABLE IF EXISTS customer_sessions;

DROP INDEX IF EXISTS idx_customers_store_email;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS uq_customers_store_phone;

ALTER TABLE customers DROP COLUMN IF EXISTS is_active;
ALTER TABLE customers DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE customers DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE customers DROP COLUMN IF EXISTS password_hash;
ALTER TABLE customers DROP COLUMN IF EXISTS email_normalized;
