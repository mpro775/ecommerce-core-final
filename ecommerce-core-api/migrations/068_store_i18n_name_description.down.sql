ALTER TABLE stores
  DROP COLUMN IF EXISTS name_ar,
  DROP COLUMN IF EXISTS name_en,
  DROP COLUMN IF EXISTS description_ar,
  DROP COLUMN IF EXISTS description_en;
