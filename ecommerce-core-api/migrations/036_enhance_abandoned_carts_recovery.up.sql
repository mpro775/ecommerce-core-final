ALTER TABLE abandoned_carts
  ADD COLUMN IF NOT EXISTS cart_id UUID REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE abandoned_carts
  ALTER COLUMN cart_total TYPE NUMERIC(12, 2)
  USING cart_total::numeric;

CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_carts_store_cart
  ON abandoned_carts (store_id, cart_id)
  WHERE cart_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_dispatchable
  ON abandoned_carts (store_id, recovery_sent_at, expires_at, created_at DESC)
  WHERE recovered_at IS NULL;
