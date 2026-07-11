DROP INDEX IF EXISTS idx_categories_media_asset;

ALTER TABLE categories
  DROP COLUMN IF EXISTS media_asset_id;
