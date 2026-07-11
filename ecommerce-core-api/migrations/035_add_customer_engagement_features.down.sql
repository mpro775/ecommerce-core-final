DROP INDEX IF EXISTS idx_restock_notifications_token;
DROP INDEX IF EXISTS idx_restock_notifications_store_product;
DROP TABLE IF EXISTS product_restock_notifications;

DROP INDEX IF EXISTS idx_restock_subscriptions_store_product;
DROP TABLE IF EXISTS product_restock_subscriptions;

DROP INDEX IF EXISTS idx_product_faq_product_status_created;
DROP INDEX IF EXISTS idx_product_faq_store_status_created;
ALTER TABLE product_faq DROP CONSTRAINT IF EXISTS product_faq_moderation_status_check;
ALTER TABLE product_faq DROP COLUMN IF EXISTS moderation_status;
ALTER TABLE product_faq DROP COLUMN IF EXISTS is_public;

DROP INDEX IF EXISTS idx_product_reviews_product_status_created;
DROP INDEX IF EXISTS idx_product_reviews_store_status_created;
DROP INDEX IF EXISTS idx_product_reviews_customer_product_unique;
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_moderation_status_check;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS moderation_status;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS moderated_by;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS moderated_at;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS order_id;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS comment;
ALTER TABLE product_reviews DROP COLUMN IF EXISTS is_verified_purchase;

ALTER TABLE products DROP COLUMN IF EXISTS questions_enabled;
