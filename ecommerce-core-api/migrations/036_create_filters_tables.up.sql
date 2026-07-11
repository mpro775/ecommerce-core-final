CREATE TABLE IF NOT EXISTS filters (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checkbox', 'radio', 'color', 'range')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_filters_store_slug_unique
  ON filters (store_id, slug);

CREATE INDEX IF NOT EXISTS idx_filters_store_active_sort
  ON filters (store_id, is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS filter_values (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  filter_id UUID NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  value_ar TEXT NOT NULL,
  value_en TEXT NOT NULL,
  slug TEXT NOT NULL,
  color_hex TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_filter_values_store_filter_slug_unique
  ON filter_values (store_id, filter_id, slug);

CREATE INDEX IF NOT EXISTS idx_filter_values_store_filter_active_sort
  ON filter_values (store_id, filter_id, is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS product_filter_values (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filter_value_id UUID NOT NULL REFERENCES filter_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_filter_values_store_product_value_unique
  ON product_filter_values (store_id, product_id, filter_value_id);

CREATE INDEX IF NOT EXISTS idx_product_filter_values_store_product
  ON product_filter_values (store_id, product_id);

CREATE TABLE IF NOT EXISTS product_filter_ranges (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filter_id UUID NOT NULL REFERENCES filters(id) ON DELETE CASCADE,
  numeric_value NUMERIC(14, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_filter_ranges_store_product_filter_unique
  ON product_filter_ranges (store_id, product_id, filter_id);

CREATE INDEX IF NOT EXISTS idx_product_filter_ranges_store_filter_numeric
  ON product_filter_ranges (store_id, filter_id, numeric_value);
