DROP INDEX IF EXISTS idx_payments_expiration_worker_claim;
ALTER TABLE payments
  DROP COLUMN IF EXISTS expiration_claimed_by,
  DROP COLUMN IF EXISTS expiration_claimed_at;
