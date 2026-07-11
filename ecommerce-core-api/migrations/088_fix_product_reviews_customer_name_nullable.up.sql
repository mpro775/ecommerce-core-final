-- 088_fix_product_reviews_customer_name_nullable.up.sql

ALTER TABLE product_reviews
ALTER COLUMN customer_name DROP NOT NULL;
