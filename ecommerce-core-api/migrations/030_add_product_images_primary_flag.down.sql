DROP INDEX IF EXISTS idx_product_images_single_primary;

ALTER TABLE product_images
  DROP COLUMN IF EXISTS is_primary;
