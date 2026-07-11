DROP INDEX IF EXISTS idx_orders_store_fulfillment_status;

ALTER TABLE orders
  DROP COLUMN IF EXISTS fulfillment_status,
  DROP COLUMN IF EXISTS fulfillment_type;
