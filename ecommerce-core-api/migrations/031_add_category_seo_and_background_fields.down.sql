DROP INDEX IF EXISTS idx_categories_background_media_asset;

ALTER TABLE categories
  DROP COLUMN IF EXISTS image_alt_ar,
  DROP COLUMN IF EXISTS image_alt_en,
  DROP COLUMN IF EXISTS background_media_asset_id,
  DROP COLUMN IF EXISTS seo_title_ar,
  DROP COLUMN IF EXISTS seo_title_en,
  DROP COLUMN IF EXISTS seo_description_ar,
  DROP COLUMN IF EXISTS seo_description_en;
