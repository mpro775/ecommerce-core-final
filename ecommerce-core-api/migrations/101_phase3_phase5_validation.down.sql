DO $$
DECLARE
  incompatible_count integer;
BEGIN
  SELECT COUNT(*) INTO incompatible_count
  FROM payments
  WHERE status IN ('submitted', 'expired', 'cancelled', 'partially_refunded');
  IF incompatible_count > 0 THEN
    RAISE EXCEPTION 'Migration 101 rollback blocked: % payment rows cannot be represented by the legacy contract', incompatible_count;
  END IF;
END $$;

UPDATE payments SET status = 'refunded' WHERE status = 'refunded';

UPDATE orders
SET status = CASE
      WHEN legacy_returned_at IS NOT NULL THEN 'returned'
      WHEN status = 'confirmed' AND fulfillment_status = 'preparing' THEN 'preparing'
      WHEN status = 'confirmed' AND fulfillment_status = 'out_for_delivery' THEN 'out_for_delivery'
      ELSE status
    END,
    fulfillment_status = CASE
      WHEN fulfillment_status = 'unfulfilled' THEN 'not_started'
      WHEN fulfillment_status = 'ready' THEN 'ready_for_pickup'
      WHEN fulfillment_status = 'fulfilled' AND fulfillment_type = 'pickup' THEN 'picked_up'
      WHEN fulfillment_status = 'fulfilled' THEN 'delivered'
      WHEN fulfillment_status = 'cancelled' THEN 'not_started'
      ELSE fulfillment_status
    END;
