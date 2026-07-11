ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS logo_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '«бнгд',
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address_details TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE stores
  ALTER COLUMN social_links SET DEFAULT '{"instagram": null, "facebook": null, "x": null, "tiktok": null, "snapchat": null, "whatsapp": null, "telegram": null, "youtube": null, "website": null}'::jsonb;

UPDATE stores
SET social_links = jsonb_build_object(
  'instagram', COALESCE(social_links->'instagram', 'null'::jsonb),
  'facebook', COALESCE(social_links->'facebook', 'null'::jsonb),
  'x', COALESCE(social_links->'x', social_links->'twitter', 'null'::jsonb),
  'tiktok', COALESCE(social_links->'tiktok', 'null'::jsonb),
  'snapchat', COALESCE(social_links->'snapchat', 'null'::jsonb),
  'whatsapp', COALESCE(social_links->'whatsapp', 'null'::jsonb),
  'telegram', COALESCE(social_links->'telegram', 'null'::jsonb),
  'youtube', COALESCE(social_links->'youtube', 'null'::jsonb),
  'website', COALESCE(social_links->'website', 'null'::jsonb)
);

UPDATE stores
SET country = '«бнгд'
WHERE country IS NULL OR BTRIM(country) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_stores_latitude_range'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT chk_stores_latitude_range
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_stores_longitude_range'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT chk_stores_longitude_range
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_stores_coordinates_pair'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT chk_stores_coordinates_pair
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL));
  END IF;
END$$;