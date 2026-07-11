DROP INDEX IF EXISTS idx_products_tags;
DROP INDEX IF EXISTS idx_products_store_published;
DROP INDEX IF EXISTS idx_products_store_brand;
DROP INDEX IF EXISTS idx_products_store_featured;

ALTER TABLE products
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS weight,
  DROP COLUMN IF EXISTS dimensions,
  DROP COLUMN IF EXISTS cost_price,
  DROP COLUMN IF EXISTS seo_title,
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS is_featured,
  DROP COLUMN IF EXISTS is_taxable,
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS min_order_quantity,
  DROP COLUMN IF EXISTS max_order_quantity,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS rating_avg,
  DROP COLUMN IF EXISTS rating_count;
