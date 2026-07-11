-- Update customers table to support authentication
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_normalized TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure unique phone per store (for guest identification)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'uq_customers_store_phone' AND table_name = 'customers'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT uq_customers_store_phone UNIQUE (store_id, phone);
  END IF;
END $$;

-- Create unique index for email per store (only for registered customers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email 
  ON customers (store_id, email_normalized) 
  WHERE email_normalized IS NOT NULL;

-- Customer sessions table
CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  rotation_counter INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_store ON customer_sessions (store_id);

-- Customer password resets table
CREATE TABLE IF NOT EXISTS customer_password_resets (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_password_resets_customer ON customer_password_resets (customer_id);
