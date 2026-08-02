DROP INDEX IF EXISTS idx_webhook_deliveries_claim;
DROP INDEX IF EXISTS idx_webhook_deliveries_endpoint_outbox;
ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_processing_lock_check,
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check,
  DROP COLUMN updated_at,
  DROP COLUMN locked_by,
  DROP COLUMN locked_at,
  DROP COLUMN status;
UPDATE webhook_deliveries SET attempt_count = attempt_count + 1;
ALTER TABLE webhook_deliveries ALTER COLUMN attempt_count DROP DEFAULT;
ALTER TABLE webhook_deliveries RENAME COLUMN last_error TO error_message;
ALTER TABLE webhook_deliveries RENAME COLUMN next_attempt_at TO next_retry_at;
ALTER TABLE webhook_deliveries RENAME COLUMN attempt_count TO attempt_number;
ALTER TABLE webhook_deliveries RENAME COLUMN source_outbox_event_id TO source_outbox_id;
CREATE UNIQUE INDEX idx_webhook_deliveries_endpoint_outbox
  ON webhook_deliveries (endpoint_id, source_outbox_id)
  WHERE source_outbox_id IS NOT NULL;
