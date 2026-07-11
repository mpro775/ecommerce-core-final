CREATE TABLE IF NOT EXISTS advanced_offers (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('bxgy', 'bundle', 'tiered_discount')),
  config JSONB NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advanced_offers_store_active
  ON advanced_offers (store_id, is_active);

CREATE INDEX IF NOT EXISTS idx_advanced_offers_store_dates
  ON advanced_offers (store_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS advanced_offer_usage (
  id UUID PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES advanced_offers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advanced_offer_usage_offer
  ON advanced_offer_usage (offer_id);

CREATE INDEX IF NOT EXISTS idx_advanced_offer_usage_store
  ON advanced_offer_usage (store_id, created_at DESC);
