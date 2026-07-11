export const STOREFRONT_EVENT_TYPES = [
  'store_visit',
  'product_view',
  'add_to_cart',
  'checkout_start',
  'checkout_complete',
  'coupon_apply',
] as const;

export type StorefrontEventType = (typeof STOREFRONT_EVENT_TYPES)[number];

export const STOREFRONT_ANALYTICS_EVENT_NAMES = [
  'sf_home_viewed',
  'sf_category_viewed',
  'sf_product_viewed',
  'sf_section_clicked',
  'sf_add_to_cart_clicked',
  'sf_cart_viewed',
  'sf_cart_item_updated',
  'sf_checkout_started',
  'sf_checkout_step_completed',
  'sf_checkout_submitted',
  'sf_checkout_completed',
  'sf_order_tracking_viewed',
  'sf_theme_editor_opened',
  'sf_theme_template_previewed',
  'sf_theme_template_applied',
  'sf_theme_draft_saved',
  'sf_theme_published',
  'sf_theme_version_restored',
  'sf_theme_validation_failed',
] as const;

export type StorefrontAnalyticsEventName = (typeof STOREFRONT_ANALYTICS_EVENT_NAMES)[number];
