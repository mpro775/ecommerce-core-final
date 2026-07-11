DROP INDEX IF EXISTS idx_product_reviews_rating;
DROP INDEX IF EXISTS idx_product_reviews_customer;
DROP INDEX IF EXISTS idx_product_reviews_product;
DROP INDEX IF EXISTS idx_product_reviews_store;
DROP TABLE IF EXISTS product_reviews;

DROP INDEX IF EXISTS idx_customer_wishlists_product;
DROP INDEX IF EXISTS idx_customer_wishlists_store;
DROP INDEX IF EXISTS idx_customer_wishlists_customer;
DROP TABLE IF EXISTS customer_wishlists;
