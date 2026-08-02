ALTER TABLE order_status_history
  RENAME COLUMN old_status TO from_status;
ALTER TABLE order_status_history
  RENAME COLUMN new_status TO to_status;
ALTER TABLE order_status_history
  RENAME COLUMN changed_by TO actor_id;
ALTER TABLE order_status_history
  RENAME COLUMN note TO reason;
ALTER TABLE order_status_history
  ADD COLUMN command TEXT,
  ADD COLUMN actor_type TEXT,
  ADD COLUMN reason_code TEXT,
  ADD COLUMN override_permission TEXT,
  ADD COLUMN request_id TEXT,
  ADD COLUMN idempotency_record_id UUID REFERENCES idempotency_keys(id) ON DELETE SET NULL,
  ADD COLUMN business_key TEXT;
UPDATE order_status_history
SET command = 'legacy.transition',
    actor_type = CASE WHEN actor_id IS NULL THEN 'system' ELSE 'admin' END,
    business_key = 'legacy:' || id::text;
ALTER TABLE order_status_history
  ALTER COLUMN command SET NOT NULL,
  ALTER COLUMN actor_type SET NOT NULL,
  ALTER COLUMN business_key SET NOT NULL,
  ADD CONSTRAINT order_status_history_actor_type_check
    CHECK (actor_type IN ('customer', 'admin', 'system', 'worker', 'integration')),
  ADD CONSTRAINT order_status_history_store_business_key_unique
    UNIQUE (store_id, business_key);

CREATE TABLE fulfillment_status_history (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  fulfillment_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  command TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system', 'worker', 'integration')),
  reason_code TEXT,
  reason TEXT,
  override_permission TEXT,
  request_id TEXT,
  idempotency_record_id UUID REFERENCES idempotency_keys(id) ON DELETE SET NULL,
  business_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_key)
);
CREATE INDEX idx_fulfillment_history_order
  ON fulfillment_status_history (store_id, order_id, created_at);

ALTER TABLE payment_status_history
  ADD COLUMN command TEXT,
  ADD COLUMN actor_type TEXT,
  ADD COLUMN reason_code TEXT,
  ADD COLUMN reason TEXT,
  ADD COLUMN override_permission TEXT,
  ADD COLUMN request_id TEXT,
  ADD COLUMN idempotency_record_id UUID REFERENCES idempotency_keys(id) ON DELETE SET NULL;
UPDATE payment_status_history
SET command = 'legacy.transition',
    actor_type = CASE WHEN reviewed_by IS NULL THEN 'system' ELSE 'admin' END,
    reason = review_note;
ALTER TABLE payment_status_history
  ALTER COLUMN command SET NOT NULL,
  ALTER COLUMN actor_type SET NOT NULL,
  ADD CONSTRAINT payment_status_history_actor_type_check
    CHECK (actor_type IN ('customer', 'admin', 'system', 'worker', 'integration'));

CREATE TABLE inventory_reservation_events (
  id UUID PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES inventory_reservations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'consumed', 'released', 'expired', 'restored')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system', 'worker', 'integration')),
  reason_code TEXT,
  business_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, business_key)
);
CREATE INDEX idx_reservation_events_reservation
  ON inventory_reservation_events (store_id, reservation_id, created_at);
