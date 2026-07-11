ALTER TABLE subscription_invoices
ALTER COLUMN currency_code SET DEFAULT 'YER';

ALTER TABLE subscription_payments
ALTER COLUMN currency_code SET DEFAULT 'YER';
