-- Drop remaining platform tables
DROP TABLE IF EXISTS "platform_admin_roles" CASCADE;
DROP TABLE IF EXISTS "platform_admin_permissions" CASCADE;
DROP TABLE IF EXISTS "platform_admin_role_permissions" CASCADE;
DROP TABLE IF EXISTS "platform_admin_user_roles" CASCADE;
DROP TABLE IF EXISTS "platform_admin_sessions" CASCADE;
DROP TABLE IF EXISTS "platform_automation_runs" CASCADE;
DROP TABLE IF EXISTS "platform_store_notes" CASCADE;
DROP TABLE IF EXISTS "platform_settings" CASCADE;
DROP TABLE IF EXISTS "platform_support_case_events" CASCADE;

-- Drop remaining subscription and billing tables
DROP TABLE IF EXISTS "usage_events" CASCADE;
DROP TABLE IF EXISTS "billing_events" CASCADE;
DROP TABLE IF EXISTS "subscription_settings" CASCADE;
DROP TABLE IF EXISTS "subscription_coupon_redemptions" CASCADE;
DROP TABLE IF EXISTS "subscription_payment_receipts" CASCADE;

-- Drop remaining QA tables
DROP TABLE IF EXISTS "qa_scenarios" CASCADE;
DROP TABLE IF EXISTS "qa_phases" CASCADE;
DROP TABLE IF EXISTS "qa_checks" CASCADE;
DROP TABLE IF EXISTS "qa_questions" CASCADE;
DROP TABLE IF EXISTS "qa_answers" CASCADE;
DROP TABLE IF EXISTS "qa_issues" CASCADE;
DROP TABLE IF EXISTS "qa_attachments" CASCADE;
DROP TABLE IF EXISTS "qa_run_summaries" CASCADE;
DROP TABLE IF EXISTS "qa_run_events" CASCADE;

-- Rename platform_payment_methods to payment_method_catalog
ALTER TABLE IF EXISTS "platform_payment_methods" RENAME TO "payment_method_catalog";
ALTER INDEX IF EXISTS "idx_platform_payment_methods_enabled_sort" RENAME TO "idx_payment_method_catalog_enabled_sort";

-- Update store_payment_methods references
ALTER TABLE IF EXISTS "store_payment_methods" RENAME COLUMN "platform_payment_method_id" TO "payment_method_catalog_id";
ALTER INDEX IF EXISTS "store_payment_methods_platform_payment_method_id_idx" RENAME TO "store_payment_methods_payment_method_catalog_id_idx";

-- Update payments references
ALTER TABLE IF EXISTS "payments" RENAME COLUMN "platform_payment_method_id" TO "payment_method_catalog_id";
ALTER INDEX IF EXISTS "idx_payments_platform_payment_method" RENAME TO "idx_payments_payment_method_catalog";
