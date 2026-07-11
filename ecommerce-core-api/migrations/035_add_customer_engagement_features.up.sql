ALTER TABLE products
  ADD COLUMN IF NOT EXISTS questions_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS comment TEXT;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES store_users(id) ON DELETE SET NULL;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

ALTER TABLE product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_moderation_status_check;

ALTER TABLE product_reviews
  ADD CONSTRAINT product_reviews_moderation_status_check
  CHECK (moderation_status IN ('PENDING', 'APPROVED', 'HIDDEN'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_reviews' AND column_name = 'review_text'
  ) THEN
    EXECUTE 'UPDATE product_reviews SET comment = COALESCE(comment, review_text)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_reviews' AND column_name = 'is_approved'
  ) THEN
    EXECUTE 'UPDATE product_reviews
      SET moderation_status = CASE WHEN is_approved THEN ''APPROVED'' ELSE ''PENDING'' END
      WHERE moderation_status IS NULL OR moderation_status = ''PENDING''';
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_product_reviews_store_status_created
  ON product_reviews (store_id, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status_created
  ON product_reviews (product_id, moderation_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_customer_product_unique
  ON product_reviews (customer_id, product_id)
  WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_faq (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES store_users(id) ON DELETE SET NULL,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_faq
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'PENDING';

ALTER TABLE product_faq
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE product_faq
  DROP CONSTRAINT IF EXISTS product_faq_moderation_status_check;

ALTER TABLE product_faq
  ADD CONSTRAINT product_faq_moderation_status_check
  CHECK (moderation_status IN ('PENDING', 'APPROVED', 'HIDDEN'));

UPDATE product_faq
SET moderation_status = CASE
  WHEN COALESCE(is_approved, FALSE) = TRUE AND COALESCE(is_public, FALSE) = TRUE THEN 'APPROVED'
  WHEN answer IS NULL THEN 'PENDING'
  ELSE 'HIDDEN'
END;

CREATE INDEX IF NOT EXISTS idx_product_faq_store_status_created
  ON product_faq (store_id, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_faq_product_status_created
  ON product_faq (product_id, moderation_status, created_at DESC);

CREATE TABLE IF NOT EXISTS product_restock_subscriptions (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_restock_subscriptions_store_product
  ON product_restock_subscriptions (store_id, product_id, is_active);

CREATE TABLE IF NOT EXISTS product_restock_notifications (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  subscription_id UUID NOT NULL REFERENCES product_restock_subscriptions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  created_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  conversion_amount NUMERIC(12,2),
  converted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restock_notifications_store_product
  ON product_restock_notifications (store_id, product_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_restock_notifications_token
  ON product_restock_notifications (token);
