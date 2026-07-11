CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  redeem_rate_points INTEGER NOT NULL DEFAULT 100 CHECK (redeem_rate_points > 0),
  redeem_rate_amount NUMERIC(12, 2) NOT NULL DEFAULT 1 CHECK (redeem_rate_amount > 0),
  min_redeem_points INTEGER NOT NULL DEFAULT 100 CHECK (min_redeem_points >= 0),
  redeem_step_points INTEGER NOT NULL DEFAULT 10 CHECK (redeem_step_points > 0),
  max_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (
    max_discount_percent > 0 AND max_discount_percent <= 100
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_store
  ON loyalty_programs (store_id);

CREATE TABLE IF NOT EXISTS loyalty_earn_rules (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('order_percent')),
  earn_rate NUMERIC(5, 2) NOT NULL DEFAULT 1 CHECK (earn_rate >= 0),
  min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_earn_rules_store_active
  ON loyalty_earn_rules (store_id, is_active, priority ASC);

CREATE TABLE IF NOT EXISTS customer_loyalty_wallets (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  available_points INTEGER NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  locked_points INTEGER NOT NULL DEFAULT 0 CHECK (locked_points >= 0),
  lifetime_earned_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned_points >= 0),
  lifetime_redeemed_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_redeemed_points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_wallets_store_customer
  ON customer_loyalty_wallets (store_id, customer_id);

CREATE TABLE IF NOT EXISTS loyalty_ledger_entries (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES customer_loyalty_wallets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earn', 'redeem', 'adjust', 'reverse')),
  points_delta INTEGER NOT NULL,
  amount_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_entry_id UUID REFERENCES loyalty_ledger_entries(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_store_user_id UUID REFERENCES store_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_entries_store_customer_created
  ON loyalty_ledger_entries (store_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_entries_store_order
  ON loyalty_ledger_entries (store_id, order_id, created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  ADD COLUMN IF NOT EXISTS points_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (points_discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS loyalty_policy TEXT;
