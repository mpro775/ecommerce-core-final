CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  commission_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 10 CHECK (commission_rate_percent >= 0 AND commission_rate_percent <= 100),
  payout_method TEXT,
  payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_store_status
  ON affiliates (store_id, status);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  target_path TEXT NOT NULL DEFAULT '/',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_links_store_code_unique
  ON affiliate_links (store_id, LOWER(code));

CREATE INDEX IF NOT EXISTS idx_affiliate_links_store_affiliate
  ON affiliate_links (store_id, affiliate_id);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_path TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_store_session_clicked
  ON affiliate_clicks (store_id, session_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_store_affiliate_clicked
  ON affiliate_clicks (store_id, affiliate_id, clicked_at DESC);

CREATE TABLE IF NOT EXISTS order_affiliate_attributions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  coupon_code TEXT,
  attribution_type TEXT NOT NULL CHECK (attribution_type IN ('coupon', 'link')),
  session_id TEXT,
  commission_rate_percent NUMERIC(5, 2) NOT NULL,
  commission_base NUMERIC(12, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_affiliate_attributions_store_affiliate
  ON order_affiliate_attributions (store_id, affiliate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attribution_id UUID NOT NULL REFERENCES order_affiliate_attributions(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'reversed', 'paid')),
  commission_base NUMERIC(12, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  reversed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12, 2) NOT NULL,
  approved_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, order_id),
  UNIQUE (attribution_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_store_affiliate_status
  ON affiliate_commissions (store_id, affiliate_id, status, approved_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_payout_batches (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'finalized', 'paid')),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'YER',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_batches_store_status
  ON affiliate_payout_batches (store_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_payout_items (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  payout_batch_id UUID NOT NULL REFERENCES affiliate_payout_batches(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES affiliate_commissions(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (commission_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payout_items_batch
  ON affiliate_payout_items (store_id, payout_batch_id);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS affiliate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS affiliate_default_rate NUMERIC(5, 2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS affiliate_attribution_window_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS affiliate_min_payout NUMERIC(12, 2) NOT NULL DEFAULT 5000;

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_store_affiliate
  ON coupons (store_id, affiliate_id);
