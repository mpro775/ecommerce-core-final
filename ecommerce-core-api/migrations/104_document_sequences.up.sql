CREATE TABLE document_sequences (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('ORD', 'INV', 'RET', 'REF')),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 9999),
  last_number BIGINT NOT NULL CHECK (last_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, document_type, year)
);

CREATE UNIQUE INDEX idx_orders_store_order_code_unique
  ON orders (store_id, order_code);

