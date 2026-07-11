ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'اليمن';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS birth_date DATE;

CREATE INDEX IF NOT EXISTS idx_customers_store_created_at
  ON customers (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_store_country_city
  ON customers (store_id, country, city);
