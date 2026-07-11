DROP INDEX IF EXISTS idx_customer_addresses_location;

ALTER TABLE customer_addresses
  DROP COLUMN IF EXISTS place_label,
  DROP COLUMN IF EXISTS map_provider,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude;
