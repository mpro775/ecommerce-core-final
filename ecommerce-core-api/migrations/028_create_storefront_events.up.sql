CREATE TABLE IF NOT EXISTS storefront_events (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'store_visit',
      'product_view',
      'add_to_cart',
      'checkout_start',
      'checkout_complete',
      'coupon_apply'
    )
  ),
  session_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_events_store_occurred
  ON storefront_events (store_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_storefront_events_store_event_occurred
  ON storefront_events (store_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_storefront_events_store_session_occurred
  ON storefront_events (store_id, session_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_storefront_events_store_source_occurred
  ON storefront_events (store_id, utm_source, utm_medium, occurred_at DESC);
