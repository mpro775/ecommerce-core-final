INSERT INTO stores (
  id,
  name,
  name_ar,
  name_en,
  slug,
  phone,
  address,
  country,
  currency_code,
  timezone,
  metadata
)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  'متجر النجوم تليكوم',
  'متجر النجوم تليكوم',
  'Nojoom Telecom',
  'nojoom-telecom',
  NULL,
  NULL,
  'اليمن',
  'YER',
  'Asia/Aden',
  '{"seeded": true, "singleStoreCore": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    slug = EXCLUDED.slug,
    country = EXCLUDED.country,
    currency_code = EXCLUDED.currency_code,
    timezone = EXCLUDED.timezone,
    metadata = stores.metadata || EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO store_users (
  id,
  store_id,
  email,
  password_hash,
  phone,
  full_name,
  role,
  permissions,
  is_active
)
VALUES (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000100',
  'owner@nojoom.local',
  '$argon2id$v=19$m=65536,t=3,p=4$avBM/ut/6bvMV7g46h0QuQ$ygmBIdxHtarXcOrWNK3R0vW0Ov1J5wvNPLfCMUbtewM',
  NULL,
  'Nojoom Telecom Owner',
  'owner',
  '["*"]'::jsonb,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET store_id = EXCLUDED.store_id,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO store_general_settings (
  store_id,
  order_settings,
  inventory_settings,
  tax_settings,
  mobile_app_config
)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  '{
    "minimumOrderValue": 0,
    "allowGuestCheckout": true,
    "allowOrderCancellation": true,
    "cancellationWindowMinutes": 60,
    "allowReturns": true,
    "returnWindowDays": 7,
    "confirmationMode": "manual",
    "stockDeductionTiming": "confirmation",
    "orderNumberPrefix": "NJM"
  }'::jsonb,
  '{
    "allowOutOfStockSales": false,
    "lowStockAlertThreshold": 5,
    "reserveInventory": true,
    "reservationTtlMinutes": 15,
    "warehouseSelectionMode": "priority",
    "warehousePriority": [],
    "restoreStockOnCancellation": true
  }'::jsonb,
  '{
    "enabled": false,
    "defaultRate": 0,
    "priceMode": "exclusive",
    "exemptions": [],
    "categoryRates": {},
    "taxNumber": null
  }'::jsonb,
  '{
    "latestAndroidVersion": null,
    "latestIosVersion": null,
    "minimumAndroidVersion": null,
    "minimumIosVersion": null,
    "forceUpdate": false,
    "maintenanceMode": false,
    "maintenanceMessage": null
  }'::jsonb
)
ON CONFLICT (store_id) DO UPDATE
SET order_settings = EXCLUDED.order_settings,
    inventory_settings = EXCLUDED.inventory_settings,
    tax_settings = EXCLUDED.tax_settings,
    mobile_app_config = EXCLUDED.mobile_app_config,
    updated_at = NOW();

INSERT INTO store_payment_methods (
  id,
  store_id,
  payment_method_catalog_id,
  is_enabled,
  sort_order
)
SELECT
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000100',
  catalog.id,
  TRUE,
  catalog.sort_order
FROM payment_method_catalog catalog
WHERE catalog.code = 'cod'
  AND catalog.is_enabled = TRUE
ON CONFLICT (store_id, payment_method_catalog_id) DO UPDATE
SET is_enabled = TRUE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
