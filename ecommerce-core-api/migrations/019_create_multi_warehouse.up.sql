CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'YE',
  phone TEXT,
  email TEXT,
  geolocation JSONB,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_store_code
  ON warehouses (store_id, LOWER(code));

CREATE INDEX IF NOT EXISTS idx_warehouses_store_active
  ON warehouses (store_id, is_active);

CREATE TABLE IF NOT EXISTS warehouse_inventory (
  id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  reorder_point INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_inventory_unique
  ON warehouse_inventory (warehouse_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_variant
  ON warehouse_inventory (variant_id);

CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_warehouse_transfers_store
  ON warehouse_transfers (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
  id UUID PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  requested_quantity INTEGER NOT NULL,
  received_quantity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_transfer_items_transfer
  ON warehouse_transfer_items (transfer_id);
