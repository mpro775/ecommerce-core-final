DROP TABLE IF EXISTS inventory_reservations;
DROP TABLE IF EXISTS inventory_movements;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_variants_low_stock_threshold_non_negative'
  ) THEN
    ALTER TABLE product_variants
      DROP CONSTRAINT chk_product_variants_low_stock_threshold_non_negative;
  END IF;
END;
$$;

ALTER TABLE product_variants
  DROP COLUMN IF EXISTS low_stock_threshold;
