DROP TABLE IF EXISTS stage3_reconciliation_audit;

DROP INDEX IF EXISTS idx_webhook_deliveries_endpoint_outbox;
ALTER TABLE webhook_deliveries DROP COLUMN IF EXISTS source_outbox_id;

DROP INDEX IF EXISTS idx_outbox_events_deduplication_key;
DROP INDEX IF EXISTS idx_outbox_events_claim;
ALTER TABLE outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_status_check,
  DROP COLUMN IF EXISTS deduplication_key,
  DROP COLUMN IF EXISTS locked_by,
  DROP COLUMN IF EXISTS locked_at;
UPDATE outbox_events SET status = 'pending' WHERE status = 'processing';
ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_status_check CHECK (status IN ('pending', 'published', 'failed'));
ALTER TABLE outbox_events RENAME COLUMN next_attempt_at TO available_at;
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_available_at
  ON outbox_events (status, available_at);

DROP TABLE IF EXISTS affiliate_commission_adjustments;
DROP INDEX IF EXISTS idx_affiliate_commissions_store_business_key;
ALTER TABLE affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_status_check,
  DROP COLUMN IF EXISTS business_key,
  DROP COLUMN IF EXISTS payable_at,
  DROP COLUMN IF EXISTS return_window_ends_at;
UPDATE affiliate_commissions SET status = 'approved' WHERE status = 'payable';
UPDATE affiliate_commissions SET status = 'reversed' WHERE status = 'cancelled';
ALTER TABLE affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_status_check
  CHECK (status IN ('pending', 'approved', 'reversed', 'paid'));

DROP INDEX IF EXISTS idx_loyalty_ledger_one_reversal;
DROP INDEX IF EXISTS idx_loyalty_ledger_store_business_key;
ALTER TABLE loyalty_ledger_entries
  DROP CONSTRAINT IF EXISTS loyalty_ledger_reversal_source_check,
  DROP CONSTRAINT IF EXISTS loyalty_ledger_balance_check,
  DROP CONSTRAINT IF EXISTS loyalty_ledger_status_check,
  DROP COLUMN IF EXISTS reversed_at,
  DROP COLUMN IF EXISTS available_at,
  DROP COLUMN IF EXISTS business_key,
  DROP COLUMN IF EXISTS source_ledger_id,
  DROP COLUMN IF EXISTS balance_before,
  DROP COLUMN IF EXISTS status;

DROP INDEX IF EXISTS idx_inventory_movements_store_key_unique;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS movement_key;
DROP INDEX IF EXISTS idx_inventory_reservations_claim_expired;
DROP INDEX IF EXISTS idx_inventory_reservations_order_variant_warehouse_unique;
ALTER TABLE inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_active_warehouse_check,
  DROP CONSTRAINT IF EXISTS inventory_reservations_stage3_state_check,
  DROP CONSTRAINT IF EXISTS inventory_reservations_status_check,
  DROP COLUMN IF EXISTS cart_id;
UPDATE inventory_reservations SET status = 'released' WHERE status = 'expired';
UPDATE inventory_reservations SET status = 'reserved' WHERE status = 'active';
ALTER TABLE inventory_reservations
  ADD CONSTRAINT inventory_reservations_status_check CHECK (status IN ('reserved', 'released', 'consumed'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_store_order_variant_unique
  ON inventory_reservations (store_id, order_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_status_expires
  ON inventory_reservations (store_id, status, expires_at);

DROP TABLE IF EXISTS coupon_customer_counters;
DROP TABLE IF EXISTS coupon_usages;
ALTER TABLE coupons
  DROP CONSTRAINT IF EXISTS coupons_stage3_limits_check,
  DROP COLUMN IF EXISTS excluded_category_ids,
  DROP COLUMN IF EXISTS included_category_ids,
  DROP COLUMN IF EXISTS excluded_product_ids,
  DROP COLUMN IF EXISTS included_product_ids,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS maximum_discount,
  DROP COLUMN IF EXISTS per_customer_limit;

DROP TABLE IF EXISTS payment_status_history;
DROP INDEX IF EXISTS idx_payments_store_order_unique;
ALTER TABLE payments DROP COLUMN IF EXISTS status_version;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_stage3_money_non_negative,
  DROP COLUMN IF EXISTS snapshot_version,
  DROP COLUMN IF EXISTS line_discount,
  DROP COLUMN IF EXISTS line_subtotal,
  DROP COLUMN IF EXISTS tax_snapshot,
  DROP COLUMN IF EXISTS attributes_snapshot,
  DROP COLUMN IF EXISTS product_image,
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS final_unit_price,
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS variant_name,
  DROP COLUMN IF EXISTS product_name;

ALTER TABLE carts DROP COLUMN IF EXISTS checked_out_order_id;
DROP INDEX IF EXISTS idx_orders_store_cart_unique;
ALTER TABLE orders DROP COLUMN IF EXISTS cart_id;

DROP INDEX IF EXISTS idx_idempotency_keys_expiry_cleanup;
ALTER TABLE idempotency_keys
  DROP CONSTRAINT IF EXISTS idempotency_keys_store_operation_key_unique,
  DROP CONSTRAINT IF EXISTS idempotency_keys_response_state_check,
  DROP CONSTRAINT IF EXISTS idempotency_keys_status_check,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS failed_at,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS response_status,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS actor_id,
  DROP COLUMN IF EXISTS operation;
UPDATE idempotency_keys SET response_body = '{}'::jsonb WHERE response_body IS NULL;
ALTER TABLE idempotency_keys ALTER COLUMN response_body SET NOT NULL;
ALTER TABLE idempotency_keys RENAME COLUMN response_body TO response;
ALTER TABLE idempotency_keys RENAME COLUMN idempotency_key TO key;
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_store_id_key_key UNIQUE (store_id, key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_store_key ON idempotency_keys (store_id, key);
