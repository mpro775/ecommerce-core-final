CREATE TABLE IF NOT EXISTS platform_payment_methods (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  icon_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('cod', 'wallet', 'bank_transfer', 'exchange_transfer', 'custom_manual')),
  requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
  requires_receipt BOOLEAN NOT NULL DEFAULT FALSE,
  is_receipt_optional BOOLEAN NOT NULL DEFAULT TRUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_methods_enabled_sort
  ON platform_payment_methods (is_enabled, sort_order, created_at);

CREATE TABLE IF NOT EXISTS store_payment_methods (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform_payment_method_id UUID NOT NULL REFERENCES platform_payment_methods(id) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  account_name TEXT,
  account_number TEXT,
  phone_number TEXT,
  iban TEXT,
  instructions_ar TEXT,
  instructions_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, platform_payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_store_payment_methods_store_enabled_sort
  ON store_payment_methods (store_id, is_enabled, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_store_payment_methods_platform
  ON store_payment_methods (platform_payment_method_id);

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS store_payment_method_id UUID REFERENCES store_payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_payment_method_id UUID REFERENCES platform_payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_name TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS instructions_ar TEXT,
  ADD COLUMN IF NOT EXISTS instructions_en TEXT,
  ADD COLUMN IF NOT EXISTS payer_reference TEXT,
  ADD COLUMN IF NOT EXISTS payer_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS payer_receipt_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_note TEXT,
  ADD COLUMN IF NOT EXISTS customer_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payments_store_payment_method
  ON payments (store_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_payments_platform_payment_method
  ON payments (platform_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_payments_method_code
  ON payments (store_id, payment_method_code);

INSERT INTO platform_payment_methods (
  id, code, name_ar, name_en, type, requires_reference, requires_receipt,
  is_receipt_optional, is_enabled, sort_order
) VALUES
  ('00000000-0000-4000-8000-000000000001', 'cod', 'الدفع عند الاستلام', 'Cash on Delivery', 'cod', FALSE, FALSE, TRUE, TRUE, 1),
  ('00000000-0000-4000-8000-000000000002', 'alkuraimi', 'كريمي', 'Alkuraimi', 'wallet', TRUE, FALSE, TRUE, TRUE, 2),
  ('00000000-0000-4000-8000-000000000003', 'jawali', 'جوالي', 'Jawali', 'wallet', TRUE, FALSE, TRUE, TRUE, 3),
  ('00000000-0000-4000-8000-000000000004', 'one_cash', 'ون كاش', 'One Cash', 'wallet', TRUE, FALSE, TRUE, TRUE, 4),
  ('00000000-0000-4000-8000-000000000005', 'bank_transfer', 'تحويل بنكي', 'Bank Transfer', 'bank_transfer', TRUE, FALSE, TRUE, TRUE, 5),
  ('00000000-0000-4000-8000-000000000006', 'exchange_transfer', 'حوالة عبر صراف', 'Exchange Transfer', 'exchange_transfer', TRUE, FALSE, TRUE, TRUE, 6)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  type = EXCLUDED.type,
  requires_reference = EXCLUDED.requires_reference,
  requires_receipt = EXCLUDED.requires_receipt,
  is_receipt_optional = EXCLUDED.is_receipt_optional,
  is_enabled = EXCLUDED.is_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO store_payment_methods (
  id, store_id, platform_payment_method_id, is_enabled, sort_order
)
SELECT gen_random_uuid(), s.id, ppm.id, TRUE, ppm.sort_order
FROM stores s
INNER JOIN platform_payment_methods ppm ON ppm.code = 'cod'
ON CONFLICT (store_id, platform_payment_method_id) DO NOTHING;

UPDATE payments p
SET payment_method_code = COALESCE(payment_method_code, method),
    payment_method_name = COALESCE(
      payment_method_name,
      CASE method
        WHEN 'cod' THEN 'الدفع عند الاستلام'
        WHEN 'transfer' THEN 'تحويل بنكي'
        ELSE method
      END
    )
WHERE payment_method_code IS NULL OR payment_method_name IS NULL;

INSERT INTO platform_admin_permissions (id, key, description)
VALUES
  ('3a3be9e4-7fdb-49f2-90bb-cbaef63a2201', 'platform.payment_methods.read', 'View platform payment methods'),
  ('39cab585-382a-4097-9e30-853a014ef440', 'platform.payment_methods.write', 'Create and edit platform payment methods')
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform_admin_roles r
INNER JOIN platform_admin_permissions p
  ON p.key IN ('platform.payment_methods.read', 'platform.payment_methods.write')
WHERE r.code IN ('super_admin', 'ops_manager')
ON CONFLICT DO NOTHING;
