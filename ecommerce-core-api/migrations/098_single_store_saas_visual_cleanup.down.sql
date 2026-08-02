-- Builder/SaaS tables are intentionally not recreated: their deletion is permanent.
-- Restore only columns and permissive value contracts needed to roll application code back.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS favicon_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS business_category TEXT,
  ADD COLUMN IF NOT EXISTS logo_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS shipping_policy TEXT,
  ADD COLUMN IF NOT EXISTS return_policy TEXT,
  ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
  ADD COLUMN IF NOT EXISTS terms_of_service TEXT,
  ADD COLUMN IF NOT EXISTS loyalty_policy TEXT;

ALTER TABLE store_general_settings
  ADD COLUMN IF NOT EXISTS profile_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE store_general_settings
  DROP CONSTRAINT IF EXISTS chk_store_general_profile_object,
  ADD CONSTRAINT chk_store_general_profile_object CHECK (jsonb_typeof(profile_settings) = 'object');

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_source_check,
  DROP CONSTRAINT IF EXISTS support_tickets_requester_type_check,
  DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_type_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_source_check
    CHECK (source IN ('merchant_portal', 'customer_portal', 'platform_console', 'system')),
  ADD CONSTRAINT support_tickets_requester_type_check
    CHECK (requester_type IN ('customer', 'store_user', 'platform', 'system')),
  ADD CONSTRAINT support_tickets_assigned_to_type_check
    CHECK (assigned_to_type IS NULL OR assigned_to_type IN ('store_user', 'platform_agent'));

ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_author_type_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_author_type_check
    CHECK (author_type IN ('customer', 'store_user', 'platform_agent', 'system'));

ALTER TABLE support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_actor_type_check;
ALTER TABLE support_ticket_events
  ADD CONSTRAINT support_ticket_events_actor_type_check
    CHECK (actor_type IN ('customer', 'store_user', 'platform_agent', 'system'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_recipient_type_check
    CHECK (recipient_type IN ('store', 'store_user', 'customer', 'platform'));
