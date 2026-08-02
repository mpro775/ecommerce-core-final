ALTER TABLE webhook_deliveries RENAME COLUMN source_outbox_id TO source_outbox_event_id;
ALTER TABLE webhook_deliveries RENAME COLUMN attempt_number TO attempt_count;
ALTER TABLE webhook_deliveries RENAME COLUMN next_retry_at TO next_attempt_at;
ALTER TABLE webhook_deliveries RENAME COLUMN error_message TO last_error;
ALTER TABLE webhook_deliveries
  ADD COLUMN status TEXT,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE webhook_deliveries
SET status = CASE
      WHEN delivered_at IS NOT NULL THEN 'delivered'
      WHEN last_error IS NOT NULL AND next_attempt_at IS NULL THEN 'failed'
      ELSE 'pending'
    END,
    attempt_count = GREATEST(attempt_count - 1, 0),
    next_attempt_at = CASE
      WHEN delivered_at IS NULL AND last_error IS NULL THEN COALESCE(next_attempt_at, NOW())
      ELSE next_attempt_at
    END,
    updated_at = COALESCE(delivered_at, created_at, NOW());

ALTER TABLE webhook_deliveries
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN attempt_count SET DEFAULT 0,
  ADD CONSTRAINT webhook_deliveries_status_check
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  ADD CONSTRAINT webhook_deliveries_processing_lock_check
    CHECK (status <> 'processing' OR (locked_at IS NOT NULL AND locked_by IS NOT NULL));

DROP INDEX IF EXISTS idx_webhook_deliveries_endpoint_outbox;
CREATE UNIQUE INDEX idx_webhook_deliveries_endpoint_outbox
  ON webhook_deliveries (endpoint_id, source_outbox_event_id)
  WHERE source_outbox_event_id IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_claim
  ON webhook_deliveries (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

