-- Phase 3 + Phase 5 lifecycle and financial contracts (Step 2: Validation and Data Mutation)
-- Ambiguous commercial state is deliberately rejected before data mutation.

DO $$
DECLARE
  issue_count integer;
BEGIN
  SELECT COUNT(*) INTO issue_count
  FROM orders o
  WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'Lifecycle migration blocked: % orders have no items', issue_count;
  END IF;

  SELECT COUNT(*) INTO issue_count
  FROM orders o
  WHERE NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.store_id = o.store_id AND p.order_id = o.id
  );
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'Lifecycle migration blocked: % orders have no payment', issue_count;
  END IF;

  SELECT COUNT(*) INTO issue_count
  FROM payments
  WHERE status = 'refunded';
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'Lifecycle migration blocked: % legacy refunded payments require verified refund amounts', issue_count;
  END IF;

  SELECT COUNT(*) INTO issue_count
  FROM orders o
  JOIN payments p ON p.store_id = o.store_id AND p.order_id = o.id
  WHERE o.status IN ('completed', 'returned') AND p.status <> 'approved';
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'Lifecycle migration blocked: % terminal orders have non-approved payment', issue_count;
  END IF;

  SELECT COUNT(*) INTO issue_count
  FROM orders o
  JOIN inventory_reservations r ON r.store_id = o.store_id AND r.order_id = o.id
  WHERE o.status IN ('completed', 'cancelled', 'returned') AND r.status = 'active';
  IF issue_count > 0 THEN
    RAISE EXCEPTION 'Lifecycle migration blocked: % terminal orders retain active reservations', issue_count;
  END IF;
END $$;

UPDATE orders
SET legacy_returned_at = COALESCE(updated_at, created_at),
    legacy_return_note = COALESCE(note, 'Historical returned state preserved by migration 101')
WHERE status = 'returned';

UPDATE orders
SET fulfillment_type = COALESCE(
      fulfillment_type,
      CASE
        WHEN shipping_method_snapshot->>'type' = 'store_pickup' THEN 'pickup'
        WHEN shipping_method_id IS NOT NULL OR shipping_zone_id IS NOT NULL THEN 'delivery'
        ELSE 'manual_coordination'
      END
    ),
    fulfillment_status = CASE
      WHEN status IN ('completed', 'returned') THEN 'fulfilled'
      WHEN status = 'cancelled' THEN 'cancelled'
      WHEN status = 'preparing' THEN 'preparing'
      WHEN status = 'out_for_delivery' THEN 'out_for_delivery'
      WHEN fulfillment_status = 'not_started' THEN 'unfulfilled'
      WHEN fulfillment_status = 'ready_for_pickup' THEN 'ready'
      WHEN fulfillment_status IN ('delivered', 'picked_up') THEN 'fulfilled'
      WHEN fulfillment_status IN ('failed', 'out_for_delivery') THEN fulfillment_status
      ELSE 'unfulfilled'
    END,
    status = CASE
      WHEN status IN ('preparing', 'out_for_delivery') THEN 'confirmed'
      WHEN status = 'returned' THEN 'completed'
      ELSE status
    END,
    confirmed_at = CASE
      WHEN status IN ('confirmed', 'preparing', 'out_for_delivery', 'completed', 'returned')
        THEN COALESCE(confirmed_at, updated_at, created_at)
      ELSE confirmed_at
    END,
    completed_at = CASE
      WHEN status IN ('completed', 'returned') THEN COALESCE(completed_at, updated_at, created_at)
      ELSE completed_at
    END,
    cancelled_at = CASE
      WHEN status = 'cancelled' THEN COALESCE(cancelled_at, updated_at, created_at)
      ELSE cancelled_at
    END;

UPDATE payments p
SET paid_amount = CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END,
    currency_code = COALESCE(o.currency_code, 'YER'),
    version = GREATEST(1, p.status_version::bigint),
    submission_version = CASE
      WHEN p.status IN ('under_review', 'approved', 'rejected') OR p.customer_submitted_at IS NOT NULL THEN 1
      ELSE 0
    END,
    review_started_at = CASE WHEN p.status = 'under_review' THEN COALESCE(p.customer_submitted_at, p.updated_at) END
FROM orders o
WHERE o.id = p.order_id AND o.store_id = p.store_id;
