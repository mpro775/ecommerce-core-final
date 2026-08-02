-- Phase 3 + Phase 5 lifecycle and financial contracts (Step 1: Additive)
-- We only add columns and indexes here so that the reconciliation script can run.

ALTER TABLE orders
  ADD COLUMN version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN legacy_returned_at TIMESTAMPTZ,
  ADD COLUMN legacy_return_note TEXT,
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN refunded_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;

CREATE INDEX idx_orders_store_lifecycle
  ON orders (store_id, status, fulfillment_status, created_at DESC);

ALTER TABLE payments
  ADD COLUMN paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN refunded_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN currency_code VARCHAR(3),
  ADD COLUMN version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN submission_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN review_started_at TIMESTAMPTZ,
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN collected_at TIMESTAMPTZ,
  ADD COLUMN collection_reference TEXT;

CREATE INDEX idx_payments_expiration_claim
  ON payments (status, expires_at, created_at)
  WHERE status IN ('pending', 'submitted') AND expires_at IS NOT NULL;
