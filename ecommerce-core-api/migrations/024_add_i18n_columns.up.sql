-- Products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

UPDATE products SET title_ar = COALESCE(title_ar, title) WHERE title IS NOT NULL;
UPDATE products SET title_en = COALESCE(title_en, title) WHERE title IS NOT NULL;
UPDATE products SET description_ar = COALESCE(description_ar, description) WHERE description IS NOT NULL;
UPDATE products SET description_en = COALESCE(description_en, description) WHERE description IS NOT NULL;

-- Categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

UPDATE categories SET name_ar = COALESCE(name_ar, name) WHERE name IS NOT NULL;
UPDATE categories SET name_en = COALESCE(name_en, name) WHERE name IS NOT NULL;
UPDATE categories SET description_ar = COALESCE(description_ar, description) WHERE description IS NOT NULL;
UPDATE categories SET description_en = COALESCE(description_en, description) WHERE description IS NOT NULL;

-- Attributes
ALTER TABLE attributes
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT;

UPDATE attributes SET name_ar = COALESCE(name_ar, name) WHERE name IS NOT NULL;
UPDATE attributes SET name_en = COALESCE(name_en, name) WHERE name IS NOT NULL;

-- Attribute Values
ALTER TABLE attribute_values
  ADD COLUMN IF NOT EXISTS value_ar TEXT,
  ADD COLUMN IF NOT EXISTS value_en TEXT;

UPDATE attribute_values SET value_ar = COALESCE(value_ar, value) WHERE value IS NOT NULL;
UPDATE attribute_values SET value_en = COALESCE(value_en, value) WHERE value IS NOT NULL;

-- Product Variants
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT;

UPDATE product_variants SET title_ar = COALESCE(title_ar, title) WHERE title IS NOT NULL;
UPDATE product_variants SET title_en = COALESCE(title_en, title) WHERE title IS NOT NULL;

-- Offers
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT;

UPDATE offers SET name_ar = COALESCE(name_ar, name) WHERE name IS NOT NULL;
UPDATE offers SET name_en = COALESCE(name_en, name) WHERE name IS NOT NULL;

-- Advanced Offers
ALTER TABLE advanced_offers
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

UPDATE advanced_offers SET name_ar = COALESCE(name_ar, name) WHERE name IS NOT NULL;
UPDATE advanced_offers SET name_en = COALESCE(name_en, name) WHERE name IS NOT NULL;
UPDATE advanced_offers SET description_ar = COALESCE(description_ar, description) WHERE description IS NOT NULL;
UPDATE advanced_offers SET description_en = COALESCE(description_en, description) WHERE description IS NOT NULL;

-- Shipping Zones
ALTER TABLE shipping_zones
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS city_ar TEXT,
  ADD COLUMN IF NOT EXISTS city_en TEXT,
  ADD COLUMN IF NOT EXISTS area_ar TEXT,
  ADD COLUMN IF NOT EXISTS area_en TEXT;

UPDATE shipping_zones SET name_ar = COALESCE(name_ar, name) WHERE name IS NOT NULL;
UPDATE shipping_zones SET name_en = COALESCE(name_en, name) WHERE name IS NOT NULL;
UPDATE shipping_zones SET city_ar = COALESCE(city_ar, city) WHERE city IS NOT NULL;
UPDATE shipping_zones SET city_en = COALESCE(city_en, city) WHERE city IS NOT NULL;
UPDATE shipping_zones SET area_ar = COALESCE(area_ar, area) WHERE area IS NOT NULL;
UPDATE shipping_zones SET area_en = COALESCE(area_en, area) WHERE area IS NOT NULL;
