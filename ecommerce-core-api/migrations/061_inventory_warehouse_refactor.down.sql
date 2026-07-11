-- Rollback Migration 061

ALTER TABLE inventory_movements
  DROP COLUMN IF EXISTS warehouse_id;

DROP INDEX IF EXISTS idx_inventory_movements_warehouse;

ALTER TABLE inventory_reservations
  DROP COLUMN IF EXISTS warehouse_id;

DROP INDEX IF EXISTS idx_inventory_reservations_warehouse;

ALTER TABLE warehouse_inventory
  DROP CONSTRAINT IF EXISTS chk_warehouse_inventory_qty_ge_reserved;

ALTER TABLE warehouse_inventory
  DROP CONSTRAINT IF EXISTS chk_warehouse_inventory_reserved_non_negative;
