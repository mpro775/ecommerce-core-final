ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS return_policy TEXT,
  ADD COLUMN IF NOT EXISTS shipping_policy TEXT,
  ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
  ADD COLUMN IF NOT EXISTS terms_of_service TEXT,
  ADD COLUMN IF NOT EXISTS about_us TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{"instagram": null, "twitter": null, "facebook": null, "whatsapp": null}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_settings JSONB NOT NULL DEFAULT '{"title": null, "description": null, "keywords": null}'::jsonb;
