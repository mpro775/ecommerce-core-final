ALTER TABLE payments
  DROP COLUMN IF EXISTS amount_yer;

ALTER TABLE order_items
  DROP COLUMN IF EXISTS line_total_yer,
  DROP COLUMN IF EXISTS unit_price_yer;

ALTER TABLE orders
  DROP COLUMN IF EXISTS points_discount_amount_yer,
  DROP COLUMN IF EXISTS discount_total_yer,
  DROP COLUMN IF EXISTS shipping_fee_yer,
  DROP COLUMN IF EXISTS total_yer,
  DROP COLUMN IF EXISTS subtotal_yer,
  DROP COLUMN IF EXISTS exchange_rate_yer_per_unit;

ALTER TABLE cart_items
  DROP COLUMN IF EXISTS unit_price_yer;

ALTER TABLE carts
  DROP COLUMN IF EXISTS exchange_rate_yer_per_unit;

DROP INDEX IF EXISTS idx_product_variant_currency_prices_variant;
DROP TABLE IF EXISTS product_variant_currency_prices;

DROP INDEX IF EXISTS idx_store_currencies_default;
DROP TABLE IF EXISTS store_currencies;

ALTER TABLE stores
  DROP COLUMN IF EXISTS default_currency_code,
  DROP COLUMN IF EXISTS base_currency_code;
