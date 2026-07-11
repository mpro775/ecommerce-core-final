DROP TABLE IF EXISTS product_digital_files;
DROP TABLE IF EXISTS product_bundle_items;
DROP TABLE IF EXISTS product_related_products;
DROP TABLE IF EXISTS product_categories;

DROP INDEX IF EXISTS idx_products_store_visible;
DROP INDEX IF EXISTS idx_products_store_type;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_download_attempts_non_negative,
  DROP CONSTRAINT IF EXISTS chk_products_inline_discount_value_non_negative,
  DROP CONSTRAINT IF EXISTS chk_products_inline_discount_type_valid,
  DROP CONSTRAINT IF EXISTS chk_products_product_type_valid;

ALTER TABLE products
  DROP COLUMN IF EXISTS digital_download_expires_at,
  DROP COLUMN IF EXISTS digital_download_attempts_limit,
  DROP COLUMN IF EXISTS inline_discount_active,
  DROP COLUMN IF EXISTS inline_discount_ends_at,
  DROP COLUMN IF EXISTS inline_discount_starts_at,
  DROP COLUMN IF EXISTS inline_discount_value,
  DROP COLUMN IF EXISTS inline_discount_type,
  DROP COLUMN IF EXISTS custom_fields,
  DROP COLUMN IF EXISTS seo_description_en,
  DROP COLUMN IF EXISTS seo_description_ar,
  DROP COLUMN IF EXISTS seo_title_en,
  DROP COLUMN IF EXISTS seo_title_ar,
  DROP COLUMN IF EXISTS detailed_description_en,
  DROP COLUMN IF EXISTS detailed_description_ar,
  DROP COLUMN IF EXISTS short_description_en,
  DROP COLUMN IF EXISTS short_description_ar,
  DROP COLUMN IF EXISTS youtube_url,
  DROP COLUMN IF EXISTS product_label,
  DROP COLUMN IF EXISTS weight_unit,
  DROP COLUMN IF EXISTS stock_unlimited,
  DROP COLUMN IF EXISTS is_visible,
  DROP COLUMN IF EXISTS product_type;
