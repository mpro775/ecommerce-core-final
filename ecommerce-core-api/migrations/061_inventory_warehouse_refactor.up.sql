-- Migration 061: Inventory & Warehouse Refactor
-- Add warehouse_id to inventory_movements and inventory_reservations
-- warehouse_inventory becomes source of truth, product_variants.stock_quantity becomes cache

-- 1. Add warehouse_id to inventory_movements
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse
  ON inventory_movements (warehouse_id);

-- 2. Add warehouse_id to inventory_reservations
ALTER TABLE inventory_reservations
  ADD COLUMN IF NOT EXISTS warehouse_id UUID NULL REFERENCES warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_warehouse
  ON inventory_reservations (warehouse_id);

-- 3. Add constraint: warehouse_inventory.quantity >= warehouse_inventory.reserved_quantity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_warehouse_inventory_qty_ge_reserved'
  ) THEN
    ALTER TABLE warehouse_inventory
      ADD CONSTRAINT chk_warehouse_inventory_qty_ge_reserved
      CHECK (quantity >= reserved_quantity);
  END IF;
END;
$$;

-- 4. Add constraint: warehouse_inventory.reserved_quantity >= 0
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_warehouse_inventory_reserved_non_negative'
  ) THEN
    ALTER TABLE warehouse_inventory
      ADD CONSTRAINT chk_warehouse_inventory_reserved_non_negative
      CHECK (reserved_quantity >= 0);
  END IF;
END;
$$;

-- 5. Backfill warehouse_id in inventory_reservations from warehouse_inventory
-- For each reservation, find the warehouse that had stock for the variant
UPDATE inventory_reservations ir
SET warehouse_id = wi.warehouse_id
FROM warehouse_inventory wi
WHERE ir.warehouse_id IS NULL
  AND wi.variant_id = ir.variant_id
  AND wi.quantity > 0
  AND ir.store_id = wi.store_id;

-- 6. Backfill warehouse_id in inventory_movements from metadata if available
-- (movements created after warehouse support have warehousePlan in metadata)

-- 7. Data repair: for variants with stock_quantity > 0 but no warehouse_inventory
-- Create warehouse_inventory rows using the default warehouse
INSERT INTO warehouse_inventory (
  id, warehouse_id, variant_id, store_id, quantity, reserved_quantity, low_stock_threshold
)
SELECT
  gen_random_uuid(),
  COALESCE(dw.id, fw.id),
  pv.id,
  pv.store_id,
  pv.stock_quantity,
  0,
  pv.low_stock_threshold
FROM product_variants pv
INNER JOIN products p ON p.id = pv.product_id
LEFT JOIN warehouse_inventory wi ON wi.variant_id = pv.id
-- Get default warehouse for the store
LEFT JOIN (
  SELECT id, store_id
  FROM warehouses
  WHERE is_default = TRUE AND is_active = TRUE
  GROUP BY id, store_id
) dw ON dw.store_id = pv.store_id
-- Fallback: first active warehouse for the store
LEFT JOIN LATERAL (
  SELECT w.id
  FROM warehouses w
  WHERE w.store_id = pv.store_id AND w.is_active = TRUE
  ORDER BY w.priority DESC, w.created_at ASC
  LIMIT 1
) fw ON dw.id IS NULL
WHERE wi.id IS NULL
  AND pv.stock_quantity > 0
  AND COALESCE(dw.id, fw.id) IS NOT NULL;

-- 8. For stores that have no warehouse at all, create a default one
INSERT INTO warehouses (id, store_id, name, code, is_default, is_active, priority)
SELECT
  gen_random_uuid(),
  s.id,
  'المستودع الافتراضي',
  'DEFAULT',
  TRUE,
  TRUE,
  0
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.store_id = s.id
);

-- 9. Re-run data repair for any variants still missing warehouse_inventory
-- (now that we've ensured all stores have at least one warehouse)
INSERT INTO warehouse_inventory (
  id, warehouse_id, variant_id, store_id, quantity, reserved_quantity, low_stock_threshold
)
SELECT
  gen_random_uuid(),
  dw.id,
  pv.id,
  pv.store_id,
  pv.stock_quantity,
  0,
  pv.low_stock_threshold
FROM product_variants pv
LEFT JOIN warehouse_inventory wi ON wi.variant_id = pv.id
-- Get default warehouse for the store (guaranteed to exist now)
LEFT JOIN (
  SELECT id, store_id
  FROM warehouses
  WHERE is_default = TRUE AND is_active = TRUE
) dw ON dw.store_id = pv.store_id
WHERE wi.id IS NULL
  AND pv.stock_quantity > 0
  AND dw.id IS NOT NULL;

-- 10. Sync stock_quantity cache for all variants
UPDATE product_variants pv
SET stock_quantity = COALESCE(s.total_wh_qty, 0),
    updated_at = NOW()
FROM (
  SELECT variant_id, SUM(quantity) AS total_wh_qty
  FROM warehouse_inventory
  GROUP BY variant_id
) s
WHERE pv.id = s.variant_id
  AND pv.stock_quantity <> COALESCE(s.total_wh_qty, 0);
