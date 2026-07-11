-- Customer Wishlists table
CREATE TABLE IF NOT EXISTS customer_wishlists (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_wishlists_customer ON customer_wishlists (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wishlists_store ON customer_wishlists (store_id);
CREATE INDEX IF NOT EXISTS idx_customer_wishlists_product ON customer_wishlists (product_id);

-- Product Reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_store ON product_reviews (store_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews (product_id, rating);
