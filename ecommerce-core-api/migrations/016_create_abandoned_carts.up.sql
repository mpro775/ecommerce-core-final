CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_phone TEXT,
  cart_data JSONB NOT NULL,
  cart_total INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  recovery_token TEXT NOT NULL UNIQUE,
  recovery_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_store_created
  ON abandoned_carts (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_token
  ON abandoned_carts (recovery_token);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_not_recovered
  ON abandoned_carts (store_id, recovery_sent_at, recovered_at)
  WHERE recovered_at IS NULL;

CREATE TABLE IF NOT EXISTS abandoned_cart_reminders (
  id UUID PRIMARY KEY,
  abandoned_cart_id UUID NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('email', 'sms')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_reminders_cart
  ON abandoned_cart_reminders (abandoned_cart_id);
