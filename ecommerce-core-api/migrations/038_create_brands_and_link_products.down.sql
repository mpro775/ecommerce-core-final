DROP INDEX IF EXISTS idx_products_store_brand_id;

ALTER TABLE products
  DROP COLUMN IF EXISTS brand_id;

DROP INDEX IF EXISTS idx_brands_store_popular;
DROP INDEX IF EXISTS idx_brands_store_active;
DROP INDEX IF EXISTS idx_brands_store_name_ar_unique;

DROP TABLE IF EXISTS brands;
