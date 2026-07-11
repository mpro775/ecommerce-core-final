ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS short_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

UPDATE warehouses
SET name_ar = COALESCE(NULLIF(TRIM(name_ar), ''), name)
WHERE name_ar IS NULL;

UPDATE warehouses
SET country = COALESCE(NULLIF(TRIM(country), ''), 'YE')
WHERE country IS NULL OR TRIM(country) = '';

UPDATE warehouses
SET geolocation = jsonb_build_object('lat', latitude, 'lng', longitude)
WHERE geolocation IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_warehouses_latitude_range'
  ) THEN
    ALTER TABLE warehouses
      ADD CONSTRAINT chk_warehouses_latitude_range
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_warehouses_longitude_range'
  ) THEN
    ALTER TABLE warehouses
      ADD CONSTRAINT chk_warehouses_longitude_range
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END;
$$;

WITH ranked_defaults AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY updated_at DESC, created_at DESC) AS row_num
  FROM warehouses
  WHERE is_default = TRUE
)
UPDATE warehouses w
SET is_default = FALSE,
    updated_at = NOW()
FROM ranked_defaults r
WHERE w.id = r.id
  AND r.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_store_single_default
  ON warehouses (store_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS warehouse_product_links (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_product_links_unique
  ON warehouse_product_links (warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_product_links_store_product
  ON warehouse_product_links (store_id, product_id);
