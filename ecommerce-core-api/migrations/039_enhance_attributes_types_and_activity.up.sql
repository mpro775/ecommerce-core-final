ALTER TABLE attributes
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

UPDATE attributes
SET type = COALESCE(type, 'dropdown');

UPDATE attributes
SET is_active = COALESCE(is_active, TRUE);

ALTER TABLE attributes
  ALTER COLUMN type SET DEFAULT 'dropdown',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_attributes_type'
  ) THEN
    ALTER TABLE attributes
      ADD CONSTRAINT chk_attributes_type CHECK (type IN ('dropdown', 'color'));
  END IF;
END $$;

ALTER TABLE attribute_values
  ADD COLUMN IF NOT EXISTS color_hex TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

UPDATE attribute_values
SET is_active = COALESCE(is_active, TRUE);

ALTER TABLE attribute_values
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attributes_store_active_type_name
  ON attributes (store_id, is_active, type, name, created_at);

CREATE INDEX IF NOT EXISTS idx_attribute_values_store_attr_active_value
  ON attribute_values (store_id, attribute_id, is_active, value, created_at);
