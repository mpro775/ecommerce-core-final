CREATE INDEX IF NOT EXISTS idx_orders_store_created_status
  ON orders (store_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_orders_store_customer_created
  ON orders (store_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_variant
  ON order_items (order_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_payments_store_created_status
  ON payments (store_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_order_status_history_store_order_created
  ON order_status_history (store_id, order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_variant_status_expires
  ON inventory_reservations (store_id, variant_id, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_variants_store_product_stock
  ON product_variants (store_id, product_id, stock_quantity);
