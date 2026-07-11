CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,
  city TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'delivered',
      'in_transit',
      'cancelled',
      'failed_delivery',
      'lost',
      'damaged',
      'delayed',
      'late_received'
    )
  ),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_store_created
  ON shipments (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_store_status
  ON shipments (store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN (
      'delivered',
      'in_transit',
      'cancelled',
      'failed_delivery',
      'lost',
      'damaged',
      'delayed',
      'late_received'
    )
  ),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_store_shipment_event_at
  ON shipment_events (store_id, shipment_id, event_at DESC);
