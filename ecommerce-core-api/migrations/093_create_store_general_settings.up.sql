CREATE TABLE IF NOT EXISTS store_general_settings (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  profile_settings JSONB NOT NULL DEFAULT '{
    "iconUrl": null,
    "primaryColor": "#111827",
    "secondaryColor": "#F59E0B",
    "supportPhone": null,
    "supportEmail": null,
    "whatsapp": null,
    "defaultLanguage": "ar",
    "supportedLanguages": ["ar", "en"]
  }'::jsonb,
  currency_settings JSONB NOT NULL DEFAULT '{
    "symbolPosition": "after",
    "pricingMode": "exchange_rate",
    "fixedPrices": {},
    "exchangeRates": {}
  }'::jsonb,
  order_settings JSONB NOT NULL DEFAULT '{
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
  inventory_settings JSONB NOT NULL DEFAULT '{
    "allowOutOfStockSales": false,
    "lowStockAlertThreshold": 5,
    "reserveInventory": true,
    "reservationTtlMinutes": 15,
    "warehouseSelectionMode": "priority",
    "warehousePriority": [],
    "restoreStockOnCancellation": true
  }'::jsonb,
  tax_settings JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "defaultRate": 0,
    "priceMode": "exclusive",
    "exemptions": [],
    "categoryRates": {},
    "taxNumber": null
  }'::jsonb,
  mobile_app_config JSONB NOT NULL DEFAULT '{
    "latestAndroidVersion": null,
    "latestIosVersion": null,
    "minimumAndroidVersion": null,
    "minimumIosVersion": null,
    "forceUpdate": false,
    "maintenanceMode": false,
    "maintenanceMessage": null,
    "storeLinks": {},
    "socialLinks": {},
    "enabledFeatures": {},
    "showRegistration": true,
    "showOtp": true,
    "showWallet": false,
    "showLoyalty": true,
    "showAffiliates": false,
    "showReviews": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_store_general_profile_object CHECK (jsonb_typeof(profile_settings) = 'object'),
  CONSTRAINT chk_store_general_currency_object CHECK (jsonb_typeof(currency_settings) = 'object'),
  CONSTRAINT chk_store_general_order_object CHECK (jsonb_typeof(order_settings) = 'object'),
  CONSTRAINT chk_store_general_inventory_object CHECK (jsonb_typeof(inventory_settings) = 'object'),
  CONSTRAINT chk_store_general_tax_object CHECK (jsonb_typeof(tax_settings) = 'object'),
  CONSTRAINT chk_store_general_mobile_object CHECK (jsonb_typeof(mobile_app_config) = 'object')
);

INSERT INTO store_general_settings (
  store_id,
  profile_settings,
  currency_settings
)
SELECT
  id,
  jsonb_build_object(
    'iconUrl', COALESCE(favicon_url, logo_url),
    'primaryColor', '#111827',
    'secondaryColor', '#F59E0B',
    'supportPhone', phone,
    'supportEmail', NULL,
    'whatsapp', social_links->>'whatsapp',
    'defaultLanguage', 'ar',
    'supportedLanguages', jsonb_build_array('ar', 'en')
  ),
  jsonb_build_object(
    'symbolPosition', 'after',
    'pricingMode', 'exchange_rate',
    'fixedPrices', '{}'::jsonb,
    'exchangeRates', '{}'::jsonb
  )
FROM stores
ON CONFLICT (store_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_store_general_settings_updated_at
  ON store_general_settings (updated_at DESC);
