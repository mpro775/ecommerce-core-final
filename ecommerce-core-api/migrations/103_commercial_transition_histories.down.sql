DROP TABLE IF EXISTS inventory_reservation_events;

ALTER TABLE payment_status_history
  DROP COLUMN idempotency_record_id,
  DROP CONSTRAINT IF EXISTS payment_status_history_actor_type_check,
  DROP COLUMN request_id,
  DROP COLUMN override_permission,
  DROP COLUMN reason,
  DROP COLUMN reason_code,
  DROP COLUMN actor_type,
  DROP COLUMN command;

DROP TABLE IF EXISTS fulfillment_status_history;

ALTER TABLE order_status_history
  DROP COLUMN idempotency_record_id,
  DROP CONSTRAINT IF EXISTS order_status_history_store_business_key_unique,
  DROP CONSTRAINT IF EXISTS order_status_history_actor_type_check,
  DROP COLUMN business_key,
  DROP COLUMN request_id,
  DROP COLUMN override_permission,
  DROP COLUMN reason_code,
  DROP COLUMN actor_type,
  DROP COLUMN command;
ALTER TABLE order_status_history RENAME COLUMN reason TO note;
ALTER TABLE order_status_history RENAME COLUMN actor_id TO changed_by;
ALTER TABLE order_status_history RENAME COLUMN to_status TO new_status;
ALTER TABLE order_status_history RENAME COLUMN from_status TO old_status;
