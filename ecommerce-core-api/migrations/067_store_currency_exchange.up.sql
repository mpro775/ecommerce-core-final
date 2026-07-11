ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS base_currency_code VARCHAR(3) NOT NULL DEFAULT 'YER',
  ADD COLUMN IF NOT EXISTS default_currency_code VARCHAR(3) NOT NULL DEFAULT 'YER';

UPDATE stores
SET base_currency_code = 'YER',
    default_currency_code = 'YER',
    currency_code = 'YER'
WHERE COALESCE(base_currency_code, '') <> 'YER'
   OR COALESCE(default_currency_code, '') = ''
   OR COALESCE(currency_code, '') <> 'YER';

CREATE TABLE IF NOT EXISTS store_currencies (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL,
  yer_per_unit NUMERIC(18, 6) NOT NULL CHECK (yer_per_unit > 0),
  decimal_digits INTEGER NOT NULL DEFAULT 2 CHECK (decimal_digits >= 0 AND decimal_digits <= 4),
  rounding_increment NUMERIC(12, 4) NOT NULL DEFAULT 0.01 CHECK (rounding_increment > 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, currency_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_currencies_default
  ON store_currencies (store_id)
  WHERE is_default = TRUE AND is_active = TRUE;

INSERT INTO store_currencies (
  id,
  store_id,
  currency_code,
  yer_per_unit,
  decimal_digits,
  rounding_increment,
  is_default,
  is_active
)
SELECT gen_random_uuid(), id, 'YER', 1, 0, 1, TRUE, TRUE
FROM stores
ON CONFLICT (store_id, currency_code) DO UPDATE
SET yer_per_unit = 1,
    decimal_digits = 0,
    rounding_increment = 1,
    is_default = TRUE,
    is_active = TRUE,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS product_variant_currency_prices (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  compare_at_price NUMERIC(12, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, variant_id, currency_code)
);

CREATE INDEX IF NOT EXISTS idx_product_variant_currency_prices_variant
  ON product_variant_currency_prices (store_id, variant_id);

ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS exchange_rate_yer_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 1;

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS unit_price_yer NUMERIC(12, 2);

UPDATE cart_items
SET unit_price_yer = unit_price
WHERE unit_price_yer IS NULL;

ALTER TABLE cart_items
  ALTER COLUMN unit_price_yer SET NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS exchange_rate_yer_per_unit NUMERIC(18, 6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal_yer NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_yer NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS shipping_fee_yer NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_total_yer NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS points_discount_amount_yer NUMERIC(12, 2);

UPDATE orders
SET subtotal_yer = COALESCE(subtotal_yer, subtotal),
    total_yer = COALESCE(total_yer, total),
    shipping_fee_yer = COALESCE(shipping_fee_yer, shipping_fee),
    discount_total_yer = COALESCE(discount_total_yer, discount_total),
    points_discount_amount_yer = COALESCE(points_discount_amount_yer, points_discount_amount)
WHERE subtotal_yer IS NULL
   OR total_yer IS NULL
   OR shipping_fee_yer IS NULL
   OR discount_total_yer IS NULL
   OR points_discount_amount_yer IS NULL;

ALTER TABLE orders
  ALTER COLUMN subtotal_yer SET NOT NULL,
  ALTER COLUMN total_yer SET NOT NULL,
  ALTER COLUMN shipping_fee_yer SET NOT NULL,
  ALTER COLUMN discount_total_yer SET NOT NULL,
  ALTER COLUMN points_discount_amount_yer SET NOT NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_price_yer NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS line_total_yer NUMERIC(12, 2);

UPDATE order_items
SET unit_price_yer = COALESCE(unit_price_yer, unit_price),
    line_total_yer = COALESCE(line_total_yer, line_total)
WHERE unit_price_yer IS NULL
   OR line_total_yer IS NULL;

ALTER TABLE order_items
  ALTER COLUMN unit_price_yer SET NOT NULL,
  ALTER COLUMN line_total_yer SET NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_yer NUMERIC(12, 2);

UPDATE payments
SET amount_yer = COALESCE(amount_yer, amount)
WHERE amount_yer IS NULL;

ALTER TABLE payments
  ALTER COLUMN amount_yer SET NOT NULL;
