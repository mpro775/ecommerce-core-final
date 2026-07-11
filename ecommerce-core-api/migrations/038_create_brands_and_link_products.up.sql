CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_store_name_ar_unique
  ON brands (store_id, LOWER(name_ar));

CREATE INDEX IF NOT EXISTS idx_brands_store_active
  ON brands (store_id, is_active);

CREATE INDEX IF NOT EXISTS idx_brands_store_popular
  ON brands (store_id, is_popular);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_store_brand_id
  ON products (store_id, brand_id) WHERE brand_id IS NOT NULL;

WITH normalized_brands AS (
  SELECT
    p.store_id,
    BTRIM(p.brand) AS brand_name,
    (
      substring(md5(p.store_id::text || ':' || LOWER(BTRIM(p.brand))), 1, 8) || '-' ||
      substring(md5(p.store_id::text || ':' || LOWER(BTRIM(p.brand))), 9, 4) || '-' ||
      substring(md5(p.store_id::text || ':' || LOWER(BTRIM(p.brand))), 13, 4) || '-' ||
      substring(md5(p.store_id::text || ':' || LOWER(BTRIM(p.brand))), 17, 4) || '-' ||
      substring(md5(p.store_id::text || ':' || LOWER(BTRIM(p.brand))), 21, 12)
    )::uuid AS generated_id
  FROM products p
  WHERE p.brand IS NOT NULL
    AND BTRIM(p.brand) <> ''
  GROUP BY p.store_id, BTRIM(p.brand)
)
INSERT INTO brands (id, store_id, name, name_ar, name_en, media_asset_id, is_active, is_popular)
SELECT
  nb.generated_id,
  nb.store_id,
  nb.brand_name,
  nb.brand_name,
  NULL,
  NULL,
  TRUE,
  FALSE
FROM normalized_brands nb
ON CONFLICT (id) DO NOTHING;

UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.store_id = b.store_id
  AND p.brand IS NOT NULL
  AND BTRIM(p.brand) <> ''
  AND LOWER(BTRIM(p.brand)) = LOWER(b.name_ar)
  AND p.brand_id IS NULL;
