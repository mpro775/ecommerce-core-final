UPDATE payments
SET store_payment_method_id = NULL,
    platform_payment_method_id = NULL,
    payer_receipt_media_asset_id = NULL;

DELETE FROM platform_admin_role_permissions
WHERE permission_id IN (
  SELECT id FROM platform_admin_permissions
  WHERE key IN ('platform.payment_methods.read', 'platform.payment_methods.write')
);

DELETE FROM platform_admin_permissions
WHERE key IN ('platform.payment_methods.read', 'platform.payment_methods.write');

DROP INDEX IF EXISTS idx_payments_method_code;
DROP INDEX IF EXISTS idx_payments_platform_payment_method;
DROP INDEX IF EXISTS idx_payments_store_payment_method;

ALTER TABLE payments
  DROP COLUMN IF EXISTS customer_submitted_at,
  DROP COLUMN IF EXISTS payer_note,
  DROP COLUMN IF EXISTS payer_receipt_media_asset_id,
  DROP COLUMN IF EXISTS payer_receipt_url,
  DROP COLUMN IF EXISTS payer_reference,
  DROP COLUMN IF EXISTS instructions_en,
  DROP COLUMN IF EXISTS instructions_ar,
  DROP COLUMN IF EXISTS iban,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS account_number,
  DROP COLUMN IF EXISTS account_name,
  DROP COLUMN IF EXISTS payment_method_name,
  DROP COLUMN IF EXISTS payment_method_code,
  DROP COLUMN IF EXISTS platform_payment_method_id,
  DROP COLUMN IF EXISTS store_payment_method_id;

UPDATE payments
SET method = CASE WHEN method = 'cod' THEN 'cod' ELSE 'transfer' END
WHERE method NOT IN ('cod', 'transfer');

ALTER TABLE payments
  ADD CONSTRAINT payments_method_check CHECK (method IN ('cod', 'transfer'));

DROP TABLE IF EXISTS store_payment_methods;
DROP TABLE IF EXISTS platform_payment_methods;
