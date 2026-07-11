ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_provider TEXT,
  ADD COLUMN IF NOT EXISTS place_label TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_addresses_location
  ON customer_addresses (store_id, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
