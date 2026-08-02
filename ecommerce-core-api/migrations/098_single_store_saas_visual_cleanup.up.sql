-- Final Phase 1/2 corrective migration. The migration runner owns the transaction.

-- Defensive cleanup for databases that reached this point through different historical paths.
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS plan_limits CASCADE;
DROP TABLE IF EXISTS plan_entitlements CASCADE;
DROP TABLE IF EXISTS store_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_invoices CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscription_coupons CASCADE;
DROP TABLE IF EXISTS subscription_adjustments CASCADE;
DROP TABLE IF EXISTS subscription_receipts CASCADE;
DROP TABLE IF EXISTS subscription_trials CASCADE;
DROP TABLE IF EXISTS usage_events CASCADE;
DROP TABLE IF EXISTS billing_events CASCADE;
DROP TABLE IF EXISTS subscription_settings CASCADE;
DROP TABLE IF EXISTS subscription_coupon_redemptions CASCADE;
DROP TABLE IF EXISTS subscription_payment_receipts CASCADE;

DROP TABLE IF EXISTS platform_admin_users CASCADE;
DROP TABLE IF EXISTS platform_admin_roles CASCADE;
DROP TABLE IF EXISTS platform_admin_permissions CASCADE;
DROP TABLE IF EXISTS platform_admin_role_permissions CASCADE;
DROP TABLE IF EXISTS platform_admin_user_roles CASCADE;
DROP TABLE IF EXISTS platform_admin_sessions CASCADE;
DROP TABLE IF EXISTS platform_support_cases CASCADE;
DROP TABLE IF EXISTS platform_support_case_events CASCADE;
DROP TABLE IF EXISTS platform_incidents CASCADE;
DROP TABLE IF EXISTS platform_risk_violations CASCADE;
DROP TABLE IF EXISTS platform_compliance_tasks CASCADE;
DROP TABLE IF EXISTS platform_automation_rules CASCADE;
DROP TABLE IF EXISTS platform_automation_runs CASCADE;
DROP TABLE IF EXISTS platform_store_notes CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;

DROP TABLE IF EXISTS qa_results CASCADE;
DROP TABLE IF EXISTS qa_runs CASCADE;
DROP TABLE IF EXISTS qa_scenarios CASCADE;
DROP TABLE IF EXISTS qa_phases CASCADE;
DROP TABLE IF EXISTS qa_checks CASCADE;
DROP TABLE IF EXISTS qa_questions CASCADE;
DROP TABLE IF EXISTS qa_answers CASCADE;
DROP TABLE IF EXISTS qa_issues CASCADE;
DROP TABLE IF EXISTS qa_attachments CASCADE;
DROP TABLE IF EXISTS qa_run_summaries CASCADE;
DROP TABLE IF EXISTS qa_run_events CASCADE;

DROP TABLE IF EXISTS platform_theme_template_preview_tokens CASCADE;
DROP TABLE IF EXISTS theme_template_versions CASCADE;
DROP TABLE IF EXISTS theme_templates CASCADE;
DROP TABLE IF EXISTS theme_versions CASCADE;
DROP TABLE IF EXISTS theme_preview_tokens CASCADE;
DROP TABLE IF EXISTS store_themes CASCADE;
DROP TABLE IF EXISTS store_domains CASCADE;
DROP TABLE IF EXISTS store_setup_progress CASCADE;
DROP TABLE IF EXISTS store_pages CASCADE;
DROP TABLE IF EXISTS seo_audit_runs CASCADE;
DROP TABLE IF EXISTS seo_fix_logs CASCADE;

-- Remove visual onboarding and static CMS fields from the operational store record.
ALTER TABLE stores
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS favicon_media_asset_id,
  DROP COLUMN IF EXISTS favicon_url,
  DROP COLUMN IF EXISTS business_category,
  DROP COLUMN IF EXISTS logo_media_asset_id,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS shipping_policy,
  DROP COLUMN IF EXISTS return_policy,
  DROP COLUMN IF EXISTS privacy_policy,
  DROP COLUMN IF EXISTS terms_of_service,
  DROP COLUMN IF EXISTS loyalty_policy;

-- Keep only operational settings. Remove entitlement and presentation keys from existing JSON.
ALTER TABLE store_general_settings
  DROP CONSTRAINT IF EXISTS chk_store_general_profile_object,
  DROP COLUMN IF EXISTS profile_settings;

UPDATE store_general_settings
SET mobile_app_config = mobile_app_config
  - 'enabledFeatures'
  - 'storeLinks'
  - 'socialLinks'
  - 'showRegistration'
  - 'showOtp'
  - 'showWallet'
  - 'showLoyalty'
  - 'showAffiliates'
  - 'showReviews',
    updated_at = NOW();

ALTER TABLE store_general_settings
  ALTER COLUMN mobile_app_config SET DEFAULT '{
    "latestAndroidVersion": null,
    "latestIosVersion": null,
    "minimumAndroidVersion": null,
    "minimumIosVersion": null,
    "forceUpdate": false,
    "maintenanceMode": false,
    "maintenanceMessage": null
  }'::jsonb;

-- Normalize support and notification values before tightening their single-store contracts.
UPDATE support_tickets SET source = 'merchant_portal' WHERE source = 'platform_console';
UPDATE support_tickets SET requester_type = 'system' WHERE requester_type = 'platform';
UPDATE support_tickets
SET assigned_to_type = NULL,
    assigned_to_store_user_id = NULL
WHERE assigned_to_type = 'platform_agent';
UPDATE support_messages SET author_type = 'system' WHERE author_type = 'platform_agent';
UPDATE support_ticket_events SET actor_type = 'system' WHERE actor_type = 'platform_agent';

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_source_check,
  DROP CONSTRAINT IF EXISTS support_tickets_requester_type_check,
  DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_type_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_source_check
    CHECK (source IN ('merchant_portal', 'customer_portal', 'system')),
  ADD CONSTRAINT support_tickets_requester_type_check
    CHECK (requester_type IN ('customer', 'store_user', 'system')),
  ADD CONSTRAINT support_tickets_assigned_to_type_check
    CHECK (assigned_to_type IS NULL OR assigned_to_type = 'store_user');

ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_author_type_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_author_type_check
    CHECK (author_type IN ('customer', 'store_user', 'system'));

ALTER TABLE support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_actor_type_check;
ALTER TABLE support_ticket_events
  ADD CONSTRAINT support_ticket_events_actor_type_check
    CHECK (actor_type IN ('customer', 'store_user', 'system'));

DELETE FROM notifications
WHERE recipient_type = 'platform'
   OR category IN ('domain', 'theme')
   OR type LIKE 'domain.%'
   OR type LIKE 'theme.%';

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_recipient_type_check
    CHECK (recipient_type IN ('store', 'store_user', 'customer'));
