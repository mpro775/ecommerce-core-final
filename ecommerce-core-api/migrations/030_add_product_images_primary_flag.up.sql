ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

WITH ranked_images AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY store_id, product_id
           ORDER BY sort_order ASC, created_at ASC
         ) AS rank_in_product
  FROM product_images
)
UPDATE product_images pi
SET is_primary = TRUE,
    updated_at = NOW()
FROM ranked_images ri
WHERE pi.id = ri.id
  AND ri.rank_in_product = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_single_primary
  ON product_images (store_id, product_id)
  WHERE is_primary = TRUE;
