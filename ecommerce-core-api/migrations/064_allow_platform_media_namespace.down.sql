ALTER TABLE media_assets ALTER COLUMN store_id TYPE UUID USING store_id::uuid;
ALTER TABLE media_assets ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
