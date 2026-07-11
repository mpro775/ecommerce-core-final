ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

UPDATE stores
SET name_ar = COALESCE(name_ar, name)
WHERE name_ar IS NULL;
