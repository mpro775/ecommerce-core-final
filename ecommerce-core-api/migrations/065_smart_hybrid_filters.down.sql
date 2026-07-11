-- Rollback Smart Hybrid Filters

ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS fk_filters_source_attribute;

ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS chk_filters_display_type;

ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS chk_filters_source_type;

DROP INDEX IF EXISTS idx_filters_store_source_attribute;
DROP INDEX IF EXISTS idx_filters_store_source_type;

ALTER TABLE filters
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS source_attribute_id,
  DROP COLUMN IF EXISTS source_key,
  DROP COLUMN IF EXISTS display_type,
  DROP COLUMN IF EXISTS is_system;
