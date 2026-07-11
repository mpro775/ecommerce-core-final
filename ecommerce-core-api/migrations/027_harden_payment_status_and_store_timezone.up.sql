UPDATE payments
SET status = 'approved'
WHERE status = 'paid';

UPDATE payments
SET status = 'rejected'
WHERE status = 'failed';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'refunded'));

UPDATE stores
SET timezone = 'Asia/Aden'
WHERE timezone IS NULL OR BTRIM(timezone) = '';
