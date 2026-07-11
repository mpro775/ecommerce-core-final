ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_store_id_fkey;
ALTER TABLE media_assets ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE media_assets ALTER COLUMN store_id TYPE TEXT USING store_id::text;
