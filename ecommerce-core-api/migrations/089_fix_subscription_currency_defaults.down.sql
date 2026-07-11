ALTER TABLE subscription_invoices
ALTER COLUMN currency_code DROP DEFAULT;

ALTER TABLE subscription_payments
ALTER COLUMN currency_code DROP DEFAULT;
