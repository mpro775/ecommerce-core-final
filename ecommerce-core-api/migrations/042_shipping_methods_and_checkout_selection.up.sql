CREATE TABLE IF NOT EXISTS shipping_methods (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shipping_zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (
    method_type IN (
      'flat_rate',
      'by_weight',
      'by_item',
      'weight_tier',
      'order_value_tier',
      'free_shipping',
      'store_pickup'
    )
  ),
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  min_delivery_days INTEGER NOT NULL DEFAULT 0 CHECK (min_delivery_days >= 0),
  max_delivery_days INTEGER NOT NULL DEFAULT 0 CHECK (max_delivery_days >= min_delivery_days),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_methods_store_zone_active
  ON shipping_methods (store_id, shipping_zone_id, is_active, sort_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS shipping_method_ranges (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shipping_method_id UUID NOT NULL REFERENCES shipping_methods(id) ON DELETE CASCADE,
  range_min NUMERIC(12, 3) NOT NULL CHECK (range_min >= 0),
  range_max NUMERIC(12, 3) CHECK (range_max IS NULL OR range_max >= range_min),
  cost NUMERIC(12, 2) NOT NULL CHECK (cost >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_method_ranges_method_sort
  ON shipping_method_ranges (shipping_method_id, sort_order ASC, range_min ASC);

ALTER TABLE shipping_zones
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS is_free_shipping BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_method_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_store_shipping_method
  ON orders (store_id, shipping_method_id);
