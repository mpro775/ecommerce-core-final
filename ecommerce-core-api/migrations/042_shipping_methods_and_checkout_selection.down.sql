DROP INDEX IF EXISTS idx_orders_store_shipping_method;

ALTER TABLE orders
  DROP COLUMN IF EXISTS shipping_method_snapshot,
  DROP COLUMN IF EXISTS shipping_method_id;

ALTER TABLE coupons
  DROP COLUMN IF EXISTS is_free_shipping;

ALTER TABLE shipping_zones
  DROP COLUMN IF EXISTS description;

DROP INDEX IF EXISTS idx_shipping_method_ranges_method_sort;
DROP TABLE IF EXISTS shipping_method_ranges;

DROP INDEX IF EXISTS idx_shipping_methods_store_zone_active;
DROP TABLE IF EXISTS shipping_methods;
