DROP INDEX IF EXISTS idx_coupons_store_affiliate;

ALTER TABLE coupons
  DROP COLUMN IF EXISTS affiliate_id;

ALTER TABLE stores
  DROP COLUMN IF EXISTS affiliate_min_payout,
  DROP COLUMN IF EXISTS affiliate_attribution_window_days,
  DROP COLUMN IF EXISTS affiliate_default_rate,
  DROP COLUMN IF EXISTS affiliate_enabled;

DROP INDEX IF EXISTS idx_affiliate_payout_items_batch;
DROP TABLE IF EXISTS affiliate_payout_items;

DROP INDEX IF EXISTS idx_affiliate_payout_batches_store_status;
DROP TABLE IF EXISTS affiliate_payout_batches;

DROP INDEX IF EXISTS idx_affiliate_commissions_store_affiliate_status;
DROP TABLE IF EXISTS affiliate_commissions;

DROP INDEX IF EXISTS idx_order_affiliate_attributions_store_affiliate;
DROP TABLE IF EXISTS order_affiliate_attributions;

DROP INDEX IF EXISTS idx_affiliate_clicks_store_affiliate_clicked;
DROP INDEX IF EXISTS idx_affiliate_clicks_store_session_clicked;
DROP TABLE IF EXISTS affiliate_clicks;

DROP INDEX IF EXISTS idx_affiliate_links_store_affiliate;
DROP TABLE IF EXISTS affiliate_links;

DROP INDEX IF EXISTS idx_affiliates_store_status;
DROP TABLE IF EXISTS affiliates;
