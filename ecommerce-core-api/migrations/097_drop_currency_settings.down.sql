ALTER TABLE store_general_settings ADD COLUMN currency_settings JSONB NOT NULL DEFAULT '{
  "symbolPosition": "after",
  "pricingMode": "exchange_rate",
  "fixedPrices": {},
  "exchangeRates": {}
}'::jsonb;
