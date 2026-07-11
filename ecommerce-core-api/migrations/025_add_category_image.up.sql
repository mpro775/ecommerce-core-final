ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_media_asset
  ON categories (media_asset_id);
