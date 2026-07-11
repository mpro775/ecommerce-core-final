ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT CHECK (
    fulfillment_type IN ('delivery', 'pickup', 'external_shipping', 'manual_coordination')
  ),
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    fulfillment_status IN (
      'not_started',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'picked_up',
      'failed'
    )
  );

UPDATE orders
SET fulfillment_type = CASE
  WHEN shipping_method_snapshot ->> 'type' = 'store_pickup' THEN 'pickup'
  ELSE 'delivery'
END
WHERE fulfillment_type IS NULL
  AND shipping_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_fulfillment_status
  ON orders (store_id, fulfillment_status);
