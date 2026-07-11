INSERT INTO outbox_events (
  id,
  aggregate_type,
  aggregate_id,
  event_type,
  payload,
  headers,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'bootstrap',
  'system.bootstrap.completed',
  '{"message":"Sprint 0 bootstrap seed"}'::jsonb,
  '{"source":"seed-script"}'::jsonb,
  'pending'
)
ON CONFLICT (id) DO NOTHING;
