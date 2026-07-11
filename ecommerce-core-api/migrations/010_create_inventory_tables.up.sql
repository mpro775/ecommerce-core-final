ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_variants_low_stock_threshold_non_negative'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT chk_product_variants_low_stock_threshold_non_negative
      CHECK (low_stock_threshold >= 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'sale', 'return', 'restock')),
  qty_delta INTEGER NOT NULL CHECK (qty_delta <> 0),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_created
  ON inventory_movements (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_variant_created
  ON inventory_movements (store_id, variant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_order_created
  ON inventory_movements (store_id, order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'released', 'consumed')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  release_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservations_store_order_variant_unique
  ON inventory_reservations (store_id, order_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_status_expires
  ON inventory_reservations (store_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_variant_status
  ON inventory_reservations (store_id, variant_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_store_order
  ON inventory_reservations (store_id, order_id);
