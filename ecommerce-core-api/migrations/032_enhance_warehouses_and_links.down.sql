DROP INDEX IF EXISTS idx_warehouse_product_links_store_product;
DROP INDEX IF EXISTS idx_warehouse_product_links_unique;
DROP TABLE IF EXISTS warehouse_product_links;

DROP INDEX IF EXISTS idx_warehouses_store_single_default;

ALTER TABLE warehouses
  DROP CONSTRAINT IF EXISTS chk_warehouses_longitude_range,
  DROP CONSTRAINT IF EXISTS chk_warehouses_latitude_range;

ALTER TABLE warehouses
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS short_address,
  DROP COLUMN IF EXISTS street,
  DROP COLUMN IF EXISTS district,
  DROP COLUMN IF EXISTS branch,
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS name_ar;
