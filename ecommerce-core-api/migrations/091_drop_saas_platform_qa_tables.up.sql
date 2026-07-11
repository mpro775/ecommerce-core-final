BEGIN;

DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS plan_limits CASCADE;
DROP TABLE IF EXISTS plan_entitlements CASCADE;
DROP TABLE IF EXISTS store_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscription_coupons CASCADE;
DROP TABLE IF EXISTS subscription_adjustments CASCADE;
DROP TABLE IF EXISTS subscription_receipts CASCADE;
DROP TABLE IF EXISTS subscription_trials CASCADE;

DROP TABLE IF EXISTS platform_admin_users CASCADE;
DROP TABLE IF EXISTS platform_support_cases CASCADE;
DROP TABLE IF EXISTS platform_incidents CASCADE;
DROP TABLE IF EXISTS platform_risk_violations CASCADE;
DROP TABLE IF EXISTS platform_compliance_tasks CASCADE;
DROP TABLE IF EXISTS platform_automation_rules CASCADE;

DROP TABLE IF EXISTS qa_runs CASCADE;
DROP TABLE IF EXISTS qa_results CASCADE;

COMMIT;
