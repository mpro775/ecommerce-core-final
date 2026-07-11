ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS chk_stores_coordinates_pair,
  DROP CONSTRAINT IF EXISTS chk_stores_longitude_range,
  DROP CONSTRAINT IF EXISTS chk_stores_latitude_range;

ALTER TABLE stores
  ALTER COLUMN social_links SET DEFAULT '{"instagram": null, "twitter": null, "facebook": null, "whatsapp": null}'::jsonb;

UPDATE stores
SET social_links = jsonb_build_object(
  'instagram', COALESCE(social_links->'instagram', 'null'::jsonb),
  'twitter', COALESCE(social_links->'x', social_links->'twitter', 'null'::jsonb),
  'facebook', COALESCE(social_links->'facebook', 'null'::jsonb),
  'whatsapp', COALESCE(social_links->'whatsapp', 'null'::jsonb)
);

ALTER TABLE stores
  DROP COLUMN IF EXISTS working_hours,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS address_details,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS logo_media_asset_id;