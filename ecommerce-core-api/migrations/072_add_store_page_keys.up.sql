ALTER TABLE store_pages
  ADD COLUMN IF NOT EXISTS page_key TEXT NULL;

ALTER TABLE store_pages
  DROP CONSTRAINT IF EXISTS chk_store_pages_page_key;

ALTER TABLE store_pages
  ADD CONSTRAINT chk_store_pages_page_key
  CHECK (
    page_key IS NULL OR page_key IN (
      'about',
      'contact',
      'shipping_policy',
      'return_policy',
      'privacy_policy',
      'terms',
      'faq'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_pages_store_page_key
  ON store_pages (store_id, page_key)
  WHERE page_key IS NOT NULL;
