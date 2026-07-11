-- 088_fix_product_reviews_customer_name_nullable.down.sql

UPDATE product_reviews
SET customer_name = 'Unknown Customer'
WHERE customer_name IS NULL;

ALTER TABLE product_reviews
ALTER COLUMN customer_name SET NOT NULL;
