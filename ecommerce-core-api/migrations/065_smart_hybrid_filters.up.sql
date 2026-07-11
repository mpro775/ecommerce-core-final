-- Smart Hybrid Filters: Add source_type and related columns to filters table
-- This enables filters to be backed by brands, attributes, prices, warehouses, or availability
-- instead of requiring manual filter_values for everything.

ALTER TABLE filters
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_attribute_id UUID NULL,
  ADD COLUMN IF NOT EXISTS source_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS display_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Add CHECK constraint for source_type
ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS chk_filters_source_type;

ALTER TABLE filters
  ADD CONSTRAINT chk_filters_source_type
  CHECK (source_type IN ('manual', 'brand', 'attribute', 'price', 'warehouse', 'availability'));

-- Add CHECK constraint for display_type
ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS chk_filters_display_type;

ALTER TABLE filters
  ADD CONSTRAINT chk_filters_display_type
  CHECK (display_type IS NULL OR display_type IN ('checkbox', 'radio', 'color', 'range', 'toggle'));

-- Foreign key from filters.source_attribute_id to attributes.id
ALTER TABLE filters
  DROP CONSTRAINT IF EXISTS fk_filters_source_attribute;

ALTER TABLE filters
  ADD CONSTRAINT fk_filters_source_attribute
  FOREIGN KEY (source_attribute_id)
  REFERENCES attributes(id)
  ON DELETE SET NULL;

-- Index for finding duplicate smart filters
CREATE INDEX IF NOT EXISTS idx_filters_store_source_type
  ON filters (store_id, source_type)
  WHERE source_type != 'manual';

CREATE INDEX IF NOT EXISTS idx_filters_store_source_attribute
  ON filters (store_id, source_attribute_id)
  WHERE source_type = 'attribute';

-- All existing filters are manual by default (the DEFAULT on column handles this)
-- No data migration needed
