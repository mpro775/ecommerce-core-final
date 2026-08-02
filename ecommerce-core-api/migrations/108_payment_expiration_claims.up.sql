ALTER TABLE payments
  ADD COLUMN expiration_claimed_at TIMESTAMPTZ,
  ADD COLUMN expiration_claimed_by TEXT;

CREATE INDEX idx_payments_expiration_worker_claim
  ON payments (expires_at, expiration_claimed_at)
  WHERE status IN ('pending', 'submitted') AND expires_at IS NOT NULL;
