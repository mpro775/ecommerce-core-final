DROP INDEX IF EXISTS idx_attribute_values_store_attr_active_value;
DROP INDEX IF EXISTS idx_attributes_store_active_type_name;

ALTER TABLE attribute_values
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS color_hex;

ALTER TABLE attributes
  DROP CONSTRAINT IF EXISTS chk_attributes_type;

ALTER TABLE attributes
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS description_en,
  DROP COLUMN IF EXISTS description_ar,
  DROP COLUMN IF EXISTS type;
