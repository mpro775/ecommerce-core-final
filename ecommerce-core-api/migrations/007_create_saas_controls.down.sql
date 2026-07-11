DROP INDEX IF EXISTS idx_usage_events_store_metric_time;
DROP TABLE IF EXISTS usage_events;

DROP INDEX IF EXISTS idx_store_subscriptions_one_current;
DROP INDEX IF EXISTS idx_store_subscriptions_store_status;
DROP TABLE IF EXISTS store_subscriptions;

DROP INDEX IF EXISTS idx_plan_limits_plan_metric_unique;
DROP TABLE IF EXISTS plan_limits;

DROP INDEX IF EXISTS idx_plans_code_unique;
DROP TABLE IF EXISTS plans;

ALTER TABLE stores
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS suspension_reason,
  DROP COLUMN IF EXISTS is_suspended;
