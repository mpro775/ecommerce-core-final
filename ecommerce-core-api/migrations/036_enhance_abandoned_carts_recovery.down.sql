DROP INDEX IF EXISTS idx_abandoned_carts_dispatchable;
DROP INDEX IF EXISTS idx_abandoned_carts_store_cart;

ALTER TABLE abandoned_carts
  ALTER COLUMN cart_total TYPE INTEGER
  USING ROUND(cart_total)::integer;

ALTER TABLE abandoned_carts
  DROP COLUMN IF EXISTS cart_id;
