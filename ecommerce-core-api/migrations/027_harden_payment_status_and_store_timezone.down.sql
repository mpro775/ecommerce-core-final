UPDATE payments
SET status = 'paid'
WHERE status = 'approved';

UPDATE payments
SET status = 'failed'
WHERE status = 'rejected';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'under_review'));
