DROP INDEX IF EXISTS idx_customers_store_country_city;
DROP INDEX IF EXISTS idx_customers_store_created_at;

ALTER TABLE customers DROP COLUMN IF EXISTS birth_date;
ALTER TABLE customers DROP COLUMN IF EXISTS city;
ALTER TABLE customers DROP COLUMN IF EXISTS country;
ALTER TABLE customers DROP COLUMN IF EXISTS gender;
