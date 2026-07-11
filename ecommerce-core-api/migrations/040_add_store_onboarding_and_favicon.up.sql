ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS favicon_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS business_category TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE stores
SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_stores_business_category'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT chk_stores_business_category
      CHECK (
        business_category IS NULL
        OR business_category IN (
          'beauty',
          'fashion',
          'abayas',
          'electronics',
          'books_stationery',
          'kids_toys',
          'furniture_decor',
          'health_wellness',
          'other'
        )
      );
  END IF;
END$$;
