ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_financial_check,
  DROP CONSTRAINT IF EXISTS payments_financial_projection_check,
  DROP CONSTRAINT IF EXISTS payments_status_check,
  ALTER COLUMN currency_code DROP NOT NULL,
  ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'refunded'));

ALTER TABLE orders
  ALTER COLUMN fulfillment_status SET DEFAULT 'not_started',
  DROP CONSTRAINT IF EXISTS orders_commercial_money_check,
  DROP CONSTRAINT IF EXISTS orders_terminal_fulfillment_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check,
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ALTER COLUMN fulfillment_type DROP NOT NULL,
  ADD CONSTRAINT orders_status_check CHECK (status IN (
    'new', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled', 'returned'
  )),
  ADD CONSTRAINT orders_fulfillment_status_check CHECK (fulfillment_status IN (
    'not_started', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up', 'failed'
  )),
  ADD CONSTRAINT orders_fulfillment_type_check CHECK (fulfillment_type IN (
    'delivery', 'pickup', 'external_shipping', 'manual_coordination'
  ));
