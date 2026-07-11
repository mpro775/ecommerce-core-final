ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS chk_stores_business_category;

ALTER TABLE stores
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS business_category,
  DROP COLUMN IF EXISTS favicon_url,
  DROP COLUMN IF EXISTS favicon_media_asset_id;
