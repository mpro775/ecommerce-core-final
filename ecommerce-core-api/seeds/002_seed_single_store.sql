INSERT INTO stores (
  id,
  name,
  slug,
  phone,
  address,
  currency_code,
  timezone,
  metadata
)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  'General Ecommerce Store',
  'store',
  NULL,
  NULL,
  'YER',
  'Asia/Aden',
  '{"seeded": true, "singleStoreCore": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
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
  'owner@example.com',
  '$argon2id$v=19$m=65536,t=3,p=4$avBM/ut/6bvMV7g46h0QuQ$ygmBIdxHtarXcOrWNK3R0vW0Ov1J5wvNPLfCMUbtewM',
  NULL,
  'Store Owner',
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
  profile_settings,
  currency_settings,
  order_settings,
  inventory_settings,
  tax_settings,
  mobile_app_config
)
VALUES (
  '00000000-0000-4000-8000-000000000100',
  '{
    "iconUrl": null,
    "primaryColor": "#111827",
    "secondaryColor": "#F59E0B",
    "supportPhone": null,
    "supportEmail": null,
    "whatsapp": null,
    "defaultLanguage": "ar",
    "supportedLanguages": ["ar", "en"]
  }'::jsonb,
  '{
    "symbolPosition": "after",
    "pricingMode": "exchange_rate",
    "fixedPrices": {},
    "exchangeRates": {}
  }'::jsonb,
  '{
    "minimumOrderValue": 0,
    "allowGuestCheckout": true,
    "allowOrderCancellation": true,
    "cancellationWindowMinutes": 60,
    "allowReturns": true,
    "returnWindowDays": 7,
    "confirmationMode": "manual",
    "stockDeductionTiming": "confirmation",
    "orderNumberPrefix": "ORD"
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
    "maintenanceMessage": null,
    "storeLinks": {},
    "socialLinks": {},
    "enabledFeatures": {
      "loyalty": true,
      "loyalty_program": true,
      "affiliates": false,
      "affiliate_program": false,
      "advancedOffers": true,
      "advanced_offers": true,
      "multiWarehouse": true,
      "multi_warehouse": true,
      "reviews": true,
      "productQuestions": true,
      "product_questions": true,
      "abandonedCarts": true,
      "abandoned_carts": true,
      "digitalProducts": false,
      "digital_products": false,
      "staff_management": true,
      "webhooks_access": true
    },
    "showRegistration": true,
    "showOtp": true,
    "showWallet": false,
    "showLoyalty": true,
    "showAffiliates": false,
    "showReviews": true
  }'::jsonb
)
ON CONFLICT (store_id) DO UPDATE
SET profile_settings = EXCLUDED.profile_settings,
    currency_settings = EXCLUDED.currency_settings,
    order_settings = EXCLUDED.order_settings,
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
  ppm.id,
  TRUE,
  ppm.sort_order
FROM payment_method_catalog ppm
WHERE ppm.code = 'cod'
ON CONFLICT (store_id, payment_method_catalog_id) DO UPDATE
SET is_enabled = TRUE,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
