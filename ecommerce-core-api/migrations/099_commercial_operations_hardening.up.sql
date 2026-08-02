-- Stage 3 commercial operations hardening.
-- This migration is deliberately forward-only and never edits historical migrations.

CREATE TABLE stage3_reconciliation_audit (
  id UUID PRIMARY KEY,
  check_name TEXT NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  entity_id UUID,
  before_value JSONB NOT NULL,
  after_value JSONB,
  action TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stage3_reconciliation_audit_created
  ON stage3_reconciliation_audit (created_at DESC);

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT store_id, order_id
    FROM payments
    GROUP BY store_id, order_id
    HAVING COUNT(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Stage 3 migration blocked: % orders have duplicate payment rows', duplicate_count;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT store_id, order_id
    FROM affiliate_commissions
    GROUP BY store_id, order_id
    HAVING COUNT(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Stage 3 migration blocked: % orders have duplicate affiliate commissions', duplicate_count;
  END IF;
END $$;

-- Atomic idempotency contract.
ALTER TABLE idempotency_keys RENAME COLUMN key TO idempotency_key;
ALTER TABLE idempotency_keys RENAME COLUMN response TO response_body;
ALTER TABLE idempotency_keys
  ADD COLUMN operation TEXT,
  ADD COLUMN actor_id UUID,
  ADD COLUMN status TEXT,
  ADD COLUMN response_status INTEGER,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN failed_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE idempotency_keys
SET operation = 'storefront.checkout',
    status = 'completed',
    response_status = 200,
    processing_started_at = created_at,
    completed_at = created_at,
    updated_at = created_at;

ALTER TABLE idempotency_keys
  ALTER COLUMN operation SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN request_hash SET NOT NULL,
  ALTER COLUMN response_body DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS idempotency_keys_store_id_key_key,
  ADD CONSTRAINT idempotency_keys_status_check
    CHECK (status IN ('processing', 'completed', 'failed')),
  ADD CONSTRAINT idempotency_keys_response_state_check CHECK (
    (status = 'processing' AND response_status IS NULL AND response_body IS NULL)
    OR (status IN ('completed', 'failed') AND response_status IS NOT NULL AND response_body IS NOT NULL)
  ),
  ADD CONSTRAINT idempotency_keys_store_operation_key_unique
    UNIQUE (store_id, operation, idempotency_key);

DROP INDEX IF EXISTS idx_idempotency_keys_store_key;
CREATE INDEX idx_idempotency_keys_expiry_cleanup
  ON idempotency_keys (expires_at, status);

-- One cart can produce at most one order.
ALTER TABLE orders
  ADD COLUMN cart_id UUID REFERENCES carts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_orders_store_cart_unique
  ON orders (store_id, cart_id)
  WHERE cart_id IS NOT NULL;
ALTER TABLE carts
  ADD COLUMN checked_out_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

-- Immutable order line snapshot.
ALTER TABLE order_items
  ADD COLUMN product_name TEXT,
  ADD COLUMN variant_name TEXT,
  ADD COLUMN discount_amount NUMERIC(12, 2),
  ADD COLUMN final_unit_price NUMERIC(12, 2),
  ADD COLUMN currency_code VARCHAR(3),
  ADD COLUMN product_image TEXT,
  ADD COLUMN attributes_snapshot JSONB,
  ADD COLUMN tax_snapshot JSONB,
  ADD COLUMN line_subtotal NUMERIC(12, 2),
  ADD COLUMN line_discount NUMERIC(12, 2),
  ADD COLUMN snapshot_version INTEGER NOT NULL DEFAULT 1;

UPDATE order_items oi
SET product_name = COALESCE(oi.product_name, oi.title),
    variant_name = COALESCE(oi.variant_name, ''),
    discount_amount = COALESCE(oi.discount_amount, 0),
    final_unit_price = COALESCE(oi.final_unit_price, oi.unit_price),
    currency_code = COALESCE(oi.currency_code, o.currency_code, 'YER'),
    attributes_snapshot = COALESCE(oi.attributes_snapshot, oi.attributes, '{}'::jsonb),
    tax_snapshot = COALESCE(oi.tax_snapshot, '{}'::jsonb),
    line_subtotal = COALESCE(oi.line_subtotal, oi.line_total),
    line_discount = COALESCE(oi.line_discount, 0)
FROM orders o
WHERE o.id = oi.order_id;

ALTER TABLE order_items
  ALTER COLUMN product_name SET NOT NULL,
  ALTER COLUMN variant_name SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN final_unit_price SET NOT NULL,
  ALTER COLUMN currency_code SET NOT NULL,
  ALTER COLUMN attributes_snapshot SET NOT NULL,
  ALTER COLUMN tax_snapshot SET NOT NULL,
  ALTER COLUMN line_subtotal SET NOT NULL,
  ALTER COLUMN line_discount SET NOT NULL,
  ADD CONSTRAINT order_items_stage3_money_non_negative CHECK (
    unit_price >= 0 AND discount_amount >= 0 AND final_unit_price >= 0
    AND line_subtotal >= 0 AND line_discount >= 0 AND line_total >= 0
  );

-- Exactly one initial checkout payment per order and SQL-owned review history.
ALTER TABLE payments
  ADD COLUMN status_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_payments_store_order_unique ON payments (store_id, order_id);
CREATE TABLE payment_status_history (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reviewed_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  review_note TEXT,
  business_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_key)
);

-- Coupon scope, authoritative usage ledger, and per-customer counter lock row.
ALTER TABLE coupons
  ADD COLUMN per_customer_limit INTEGER,
  ADD COLUMN maximum_discount NUMERIC(12, 2),
  ADD COLUMN currency_code VARCHAR(3),
  ADD COLUMN included_product_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN excluded_product_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN included_category_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN excluded_category_ids UUID[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT coupons_stage3_limits_check CHECK (
    (per_customer_limit IS NULL OR per_customer_limit > 0)
    AND (maximum_discount IS NULL OR maximum_discount >= 0)
  );

CREATE TABLE coupon_usages (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  coupon_code_snapshot TEXT NOT NULL,
  discount_amount NUMERIC(12, 2) NOT NULL CHECK (discount_amount >= 0),
  currency_code VARCHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('consumed', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  UNIQUE (store_id, coupon_id, order_id)
);
CREATE INDEX idx_coupon_usages_customer_limit
  ON coupon_usages (store_id, coupon_id, customer_id, status);
CREATE TABLE coupon_customer_counters (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  consumed_count INTEGER NOT NULL DEFAULT 0 CHECK (consumed_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, coupon_id, customer_id)
);

-- Inventory reservation lifecycle and movement idempotency.
UPDATE inventory_reservations SET status = 'active' WHERE status = 'reserved';
ALTER TABLE inventory_reservations
  DROP CONSTRAINT IF EXISTS inventory_reservations_status_check,
  ADD COLUMN cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  ADD CONSTRAINT inventory_reservations_status_check
    CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  ADD CONSTRAINT inventory_reservations_stage3_state_check CHECK (
    quantity > 0
    AND (status <> 'active' OR (consumed_at IS NULL AND released_at IS NULL))
    AND (status <> 'consumed' OR consumed_at IS NOT NULL)
    AND (status NOT IN ('released', 'expired') OR released_at IS NOT NULL)
  );
ALTER TABLE inventory_reservations
  ADD CONSTRAINT inventory_reservations_active_warehouse_check
  CHECK (status <> 'active' OR warehouse_id IS NOT NULL) NOT VALID;
DROP INDEX IF EXISTS idx_inventory_reservations_store_order_variant_unique;
CREATE UNIQUE INDEX idx_inventory_reservations_order_variant_warehouse_unique
  ON inventory_reservations (store_id, order_id, variant_id)
  WHERE order_id IS NOT NULL;
DROP INDEX IF EXISTS idx_inventory_reservations_store_status_expires;
CREATE INDEX idx_inventory_reservations_claim_expired
  ON inventory_reservations (status, expires_at, created_at);

ALTER TABLE inventory_movements ADD COLUMN movement_key TEXT;
UPDATE inventory_movements SET movement_key = 'legacy:' || id::text WHERE movement_key IS NULL;
ALTER TABLE inventory_movements ALTER COLUMN movement_key SET NOT NULL;
CREATE UNIQUE INDEX idx_inventory_movements_store_key_unique
  ON inventory_movements (store_id, movement_key);

-- Loyalty ledger proof fields and duplicate-proof business keys.
ALTER TABLE loyalty_ledger_entries
  ADD COLUMN status TEXT,
  ADD COLUMN balance_before INTEGER,
  ADD COLUMN source_ledger_id UUID REFERENCES loyalty_ledger_entries(id) ON DELETE RESTRICT,
  ADD COLUMN business_key TEXT,
  ADD COLUMN available_at TIMESTAMPTZ,
  ADD COLUMN reversed_at TIMESTAMPTZ;
UPDATE loyalty_ledger_entries
SET status = 'available',
    balance_before = balance_after - points_delta,
    source_ledger_id = reference_entry_id,
    business_key = 'legacy:' || id::text,
    available_at = created_at;
ALTER TABLE loyalty_ledger_entries
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN balance_before SET NOT NULL,
  ALTER COLUMN business_key SET NOT NULL,
  ADD CONSTRAINT loyalty_ledger_status_check CHECK (status IN ('pending', 'available', 'reversed')),
  ADD CONSTRAINT loyalty_ledger_balance_check CHECK (balance_before >= 0 AND balance_after >= 0),
  ADD CONSTRAINT loyalty_ledger_reversal_source_check CHECK (
    entry_type <> 'reverse' OR COALESCE(source_ledger_id, reference_entry_id) IS NOT NULL
  );
CREATE UNIQUE INDEX idx_loyalty_ledger_store_business_key
  ON loyalty_ledger_entries (store_id, business_key);
CREATE UNIQUE INDEX idx_loyalty_ledger_one_reversal
  ON loyalty_ledger_entries (store_id, source_ledger_id)
  WHERE source_ledger_id IS NOT NULL AND entry_type = 'reverse';

-- Affiliate payable lifecycle and paid clawback audit.
ALTER TABLE affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_status_check,
  ADD COLUMN return_window_ends_at TIMESTAMPTZ,
  ADD COLUMN payable_at TIMESTAMPTZ,
  ADD COLUMN business_key TEXT,
  ADD CONSTRAINT affiliate_commissions_status_check
    CHECK (status IN ('pending', 'approved', 'payable', 'paid', 'reversed', 'cancelled'));
UPDATE affiliate_commissions
SET business_key = 'order:' || order_id::text,
    return_window_ends_at = COALESCE(return_window_ends_at, created_at + INTERVAL '14 days');
ALTER TABLE affiliate_commissions ALTER COLUMN business_key SET NOT NULL;
CREATE UNIQUE INDEX idx_affiliate_commissions_store_business_key
  ON affiliate_commissions (store_id, business_key);
CREATE TABLE affiliate_commission_adjustments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES affiliate_commissions(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL,
  business_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_key)
);

-- Transactional Outbox claim/retry contract.
ALTER TABLE outbox_events RENAME COLUMN available_at TO next_attempt_at;
ALTER TABLE outbox_events
  DROP CONSTRAINT IF EXISTS outbox_events_status_check,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by TEXT,
  ADD COLUMN deduplication_key TEXT,
  ADD CONSTRAINT outbox_events_status_check
    CHECK (status IN ('pending', 'processing', 'published', 'failed'));
UPDATE outbox_events
SET deduplication_key = 'legacy:' || id::text,
    status = CASE WHEN status = 'failed' THEN 'failed' ELSE status END;
DROP INDEX IF EXISTS idx_outbox_events_status_available_at;
CREATE INDEX idx_outbox_events_claim
  ON outbox_events (status, next_attempt_at, created_at);
CREATE UNIQUE INDEX idx_outbox_events_deduplication_key
  ON outbox_events (deduplication_key)
  WHERE deduplication_key IS NOT NULL;

-- Webhook rows are projected idempotently from Outbox events.
ALTER TABLE webhook_deliveries
  ADD COLUMN source_outbox_id UUID REFERENCES outbox_events(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_webhook_deliveries_endpoint_outbox
  ON webhook_deliveries (endpoint_id, source_outbox_id)
  WHERE source_outbox_id IS NOT NULL;
