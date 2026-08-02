-- Phase 3 + Phase 5 lifecycle and financial contracts (Step 3: Final Contracts)
-- Applies NOT NULL and CHECK constraints after data mutation is fully validated.

ALTER TABLE orders
  ALTER COLUMN fulfillment_type SET NOT NULL,
  ALTER COLUMN fulfillment_status SET DEFAULT 'unfulfilled',
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check,
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('new', 'confirmed', 'completed', 'cancelled')),
  ADD CONSTRAINT orders_fulfillment_status_check
    CHECK (fulfillment_status IN (
      'unfulfilled', 'preparing', 'ready', 'out_for_delivery',
      'fulfilled', 'failed', 'cancelled'
    )),
  ADD CONSTRAINT orders_fulfillment_type_check
    CHECK (fulfillment_type IN ('delivery', 'pickup', 'external_shipping', 'manual_coordination')),
  ADD CONSTRAINT orders_terminal_fulfillment_check CHECK (
    (status <> 'completed' OR fulfillment_status = 'fulfilled')
    AND (status <> 'cancelled' OR fulfillment_status = 'cancelled')
  ),
  ADD CONSTRAINT orders_commercial_money_check CHECK (
    subtotal >= 0 AND shipping_fee >= 0 AND discount_total >= 0 AND tax_amount >= 0
    AND total >= 0 AND paid_amount >= 0 AND refunded_amount >= 0
    AND paid_amount <= total AND refunded_amount <= paid_amount
  );

ALTER TABLE payments
  ALTER COLUMN currency_code SET NOT NULL,
  DROP CONSTRAINT IF EXISTS payments_status_check,
  ADD CONSTRAINT payments_status_check CHECK (status IN (
    'pending', 'submitted', 'under_review', 'approved', 'rejected',
    'expired', 'cancelled', 'partially_refunded', 'refunded'
  )),
  ADD CONSTRAINT payments_financial_projection_check CHECK (
    amount >= 0 AND paid_amount >= 0 AND refunded_amount >= 0
    AND paid_amount <= amount AND refunded_amount <= paid_amount
  ),
  ADD CONSTRAINT payments_status_financial_check CHECK (
    (status <> 'approved' OR paid_amount > 0)
    AND (status NOT IN ('pending', 'submitted', 'under_review', 'rejected', 'expired', 'cancelled')
      OR refunded_amount = 0)
    AND (status <> 'partially_refunded'
      OR (refunded_amount > 0 AND refunded_amount < paid_amount))
    AND (status <> 'refunded'
      OR (paid_amount > 0 AND refunded_amount = paid_amount))
  );
