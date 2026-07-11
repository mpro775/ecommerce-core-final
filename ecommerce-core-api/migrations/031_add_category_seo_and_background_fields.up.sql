ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_alt_ar TEXT,
  ADD COLUMN IF NOT EXISTS image_alt_en TEXT,
  ADD COLUMN IF NOT EXISTS background_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seo_title_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_en TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_en TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_background_media_asset
  ON categories (background_media_asset_id);
