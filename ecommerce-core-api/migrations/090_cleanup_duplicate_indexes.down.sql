CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_email
ON customers (store_id, email_normalized)
WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_admin_roles_code_unique
ON platform_admin_roles (lower(code));

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_customer_product
ON product_reviews (customer_id, product_id)
WHERE customer_id IS NOT NULL;
