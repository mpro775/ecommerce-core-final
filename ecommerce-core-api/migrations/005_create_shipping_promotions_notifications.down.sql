DROP TABLE IF EXISTS notification_deliveries;

ALTER TABLE orders
  DROP COLUMN IF EXISTS coupon_code,
  DROP COLUMN IF EXISTS discount_total,
  DROP COLUMN IF EXISTS shipping_fee,
  DROP COLUMN IF EXISTS shipping_zone_id;

DROP TABLE IF EXISTS offers;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS shipping_zones;
