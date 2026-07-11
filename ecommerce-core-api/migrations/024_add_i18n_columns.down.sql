-- Revert i18n columns
ALTER TABLE products
  DROP COLUMN IF EXISTS title_ar,
  DROP COLUMN IF EXISTS title_en,
  DROP COLUMN IF EXISTS description_ar,
  DROP COLUMN IF EXISTS description_en;

ALTER TABLE categories
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS description_ar,
  DROP COLUMN IF EXISTS description_en;

ALTER TABLE attributes
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en;

ALTER TABLE attribute_values
  DROP COLUMN IF EXISTS value_ar,
  DROP COLUMN IF EXISTS value_en;

ALTER TABLE product_variants
  DROP COLUMN IF EXISTS title_ar,
  DROP COLUMN IF EXISTS title_en;

ALTER TABLE offers
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en;

ALTER TABLE advanced_offers
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS description_ar,
  DROP COLUMN IF EXISTS description_en;

ALTER TABLE shipping_zones
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS city_ar,
  DROP COLUMN IF EXISTS city_en,
  DROP COLUMN IF EXISTS area_ar,
  DROP COLUMN IF EXISTS area_en;
