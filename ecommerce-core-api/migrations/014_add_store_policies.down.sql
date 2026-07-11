ALTER TABLE stores
  DROP COLUMN IF EXISTS return_policy,
  DROP COLUMN IF EXISTS shipping_policy,
  DROP COLUMN IF EXISTS privacy_policy,
  DROP COLUMN IF EXISTS terms_of_service,
  DROP COLUMN IF EXISTS about_us,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS social_links,
  DROP COLUMN IF EXISTS seo_settings;
