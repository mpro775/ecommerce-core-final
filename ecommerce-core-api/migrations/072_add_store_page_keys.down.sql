DROP INDEX IF EXISTS idx_store_pages_store_page_key;

ALTER TABLE store_pages
  DROP CONSTRAINT IF EXISTS chk_store_pages_page_key;

ALTER TABLE store_pages
  DROP COLUMN IF EXISTS page_key;
