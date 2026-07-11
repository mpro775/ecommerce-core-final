ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS seo_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS store_pages (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'custom',
  title_ar TEXT NULL,
  title_en TEXT NULL,
  content_ar TEXT NULL,
  content_en TEXT NULL,
  excerpt_ar TEXT NULL,
  excerpt_en TEXT NULL,
  seo_title_ar TEXT NULL,
  seo_title_en TEXT NULL,
  seo_description_ar TEXT NULL,
  seo_description_en TEXT NULL,
  og_image TEXT NULL,
  faq_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_index BOOLEAN NOT NULL DEFAULT TRUE,
  seo_follow BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_header BOOLEAN NOT NULL DEFAULT FALSE,
  show_in_footer BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE store_pages
  DROP CONSTRAINT IF EXISTS chk_store_pages_status;

ALTER TABLE store_pages
  ADD CONSTRAINT chk_store_pages_status
  CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE store_pages
  DROP CONSTRAINT IF EXISTS chk_store_pages_type;

ALTER TABLE store_pages
  ADD CONSTRAINT chk_store_pages_type
  CHECK (page_type IN ('custom', 'about', 'contact', 'faq', 'policy'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_pages_store_slug
  ON store_pages (store_id, slug);

CREATE INDEX IF NOT EXISTS idx_store_pages_store_status
  ON store_pages (store_id, status, sort_order);
