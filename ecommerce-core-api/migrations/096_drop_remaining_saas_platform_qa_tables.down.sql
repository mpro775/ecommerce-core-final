-- Reverse renaming
ALTER INDEX IF EXISTS "idx_payments_payment_method_catalog" RENAME TO "idx_payments_platform_payment_method";
ALTER TABLE IF EXISTS "payments" RENAME COLUMN "payment_method_catalog_id" TO "platform_payment_method_id";

-- The previous constraint name might have been dynamically generated or explicit, we just do best effort
ALTER INDEX IF EXISTS "store_payment_methods_payment_method_catalog_id_idx" RENAME TO "store_payment_methods_platform_payment_method_id_idx";
ALTER TABLE IF EXISTS "store_payment_methods" RENAME COLUMN "payment_method_catalog_id" TO "platform_payment_method_id";

ALTER INDEX IF EXISTS "idx_payment_method_catalog_enabled_sort" RENAME TO "idx_platform_payment_methods_enabled_sort";
ALTER TABLE IF EXISTS "payment_method_catalog" RENAME TO "platform_payment_methods";

-- Note: Dropped tables are not recreated in down migration as they are permanently removed.
