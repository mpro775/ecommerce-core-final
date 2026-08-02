import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ecommerce_core:password@localhost:5432/ecommerce_core_store';
const verifySeed = process.env.VERIFY_SEED === '1';
const client = new pg.Client({ connectionString });

const forbiddenTables = [
  'plans', 'plan_limits', 'plan_entitlements', 'store_subscriptions',
  'subscription_invoices', 'subscription_payments', 'subscription_coupons',
  'subscription_adjustments', 'subscription_receipts', 'subscription_trials',
  'usage_events', 'billing_events', 'subscription_settings',
  'subscription_coupon_redemptions', 'subscription_payment_receipts',
  'platform_admin_users', 'platform_admin_roles', 'platform_admin_permissions',
  'platform_admin_role_permissions', 'platform_admin_user_roles', 'platform_admin_sessions',
  'platform_settings', 'platform_support_cases', 'platform_support_case_events',
  'platform_incidents', 'platform_risk_violations', 'platform_compliance_tasks',
  'platform_automation_rules', 'platform_automation_runs', 'platform_store_notes',
  'qa_runs', 'qa_results', 'qa_scenarios', 'qa_phases', 'qa_checks', 'qa_questions',
  'qa_answers', 'qa_issues', 'qa_attachments', 'qa_run_summaries', 'qa_run_events',
  'store_themes', 'store_domains', 'theme_templates', 'theme_versions',
  'theme_preview_tokens', 'theme_template_versions',
  'platform_theme_template_preview_tokens', 'store_setup_progress', 'store_pages',
];
const requiredTables = [
  'stores', 'store_users', 'products', 'product_variants', 'categories', 'brands',
  'inventory_movements', 'inventory_reservations', 'warehouses', 'warehouse_inventory',
  'carts', 'orders', 'order_items', 'payments', 'payment_method_catalog',
  'store_payment_methods', 'customers', 'shipping_zones', 'shipping_methods',
  'coupons', 'offers', 'notifications', 'audit_logs', 'store_general_settings',
];
const forbiddenStoreColumns = [
  'onboarding_completed_at', 'favicon_media_asset_id', 'favicon_url', 'business_category',
  'logo_media_asset_id', 'logo_url', 'shipping_policy', 'return_policy',
  'privacy_policy', 'terms_of_service', 'loyalty_policy',
];
const expectedGeneralColumns = [
  'created_at', 'inventory_settings', 'mobile_app_config', 'order_settings',
  'store_id', 'tax_settings', 'updated_at',
];

function fail(message) {
  throw new Error(`Database verification failed: ${message}`);
}

try {
  await client.connect();

  const relations = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tableSet = new Set(relations.rows.map((row) => row.tablename));
  const unexpected = forbiddenTables.filter((table) => tableSet.has(table));
  if (unexpected.length) fail(`forbidden tables exist: ${unexpected.join(', ')}`);
  const missing = requiredTables.filter((table) => !tableSet.has(table));
  if (missing.length) fail(`required tables are missing: ${missing.join(', ')}`);

  const storeColumnsResult = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'stores'`,
  );
  const storeColumns = new Set(storeColumnsResult.rows.map((row) => row.column_name));
  const staleColumns = forbiddenStoreColumns.filter((column) => storeColumns.has(column));
  if (staleColumns.length) fail(`obsolete stores columns exist: ${staleColumns.join(', ')}`);

  const generalColumnsResult = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'store_general_settings'
     ORDER BY column_name`,
  );
  const generalColumns = generalColumnsResult.rows.map((row) => row.column_name);
  if (JSON.stringify(generalColumns) !== JSON.stringify(expectedGeneralColumns)) {
    fail(`store_general_settings columns are ${generalColumns.join(', ')}`);
  }

  const jsonViolations = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM store_general_settings
     WHERE mobile_app_config ?| ARRAY[
       'enabledFeatures', 'storeLinks', 'socialLinks', 'showRegistration', 'showOtp',
       'showWallet', 'showLoyalty', 'showAffiliates', 'showReviews'
     ]`,
  );
  if (jsonViolations.rows[0].count !== 0) fail('mobile_app_config contains legacy keys');

  const latest = await client.query(
    `SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1`,
  );
  if (latest.rows[0]?.name !== '098_single_store_saas_visual_cleanup') {
    fail(`latest migration is ${latest.rows[0]?.name ?? 'missing'}`);
  }

  const oldSupportValues = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM support_tickets
          WHERE source = 'platform_console' OR requester_type = 'platform'
             OR assigned_to_type = 'platform_agent')::int
       + (SELECT COUNT(*) FROM support_messages WHERE author_type = 'platform_agent')::int
       + (SELECT COUNT(*) FROM support_ticket_events WHERE actor_type = 'platform_agent')::int
       + (SELECT COUNT(*) FROM notifications
          WHERE recipient_type = 'platform' OR category IN ('domain', 'theme'))::int AS count`,
  );
  if (oldSupportValues.rows[0].count !== 0) fail('legacy support/notification values remain');

  const paymentColumns = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('payments', 'store_payment_methods')
       AND column_name IN ('payment_method_catalog_id', 'platform_payment_method_id')`,
  );
  const paymentColumnSet = new Set(paymentColumns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  for (const table of ['payments', 'store_payment_methods']) {
    if (!paymentColumnSet.has(`${table}.payment_method_catalog_id`)) {
      fail(`${table}.payment_method_catalog_id is missing`);
    }
    if (paymentColumnSet.has(`${table}.platform_payment_method_id`)) {
      fail(`${table}.platform_payment_method_id still exists`);
    }
  }

  if (verifySeed) {
    const seedState = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM stores)::int AS stores,
         (SELECT COUNT(*) FROM stores
           WHERE id = '00000000-0000-4000-8000-000000000100'
             AND name = 'متجر النجوم تليكوم')::int AS intended_store,
         (SELECT COUNT(*) FROM store_users
           WHERE store_id = '00000000-0000-4000-8000-000000000100'
             AND email = 'owner@nojoom.local' AND role = 'owner' AND is_active)::int AS owners,
         (SELECT COUNT(*) FROM store_payment_methods spm
           JOIN payment_method_catalog catalog ON catalog.id = spm.payment_method_catalog_id
           WHERE spm.store_id = '00000000-0000-4000-8000-000000000100'
             AND catalog.code = 'cod' AND spm.is_enabled)::int AS payment_methods`,
    );
    const state = seedState.rows[0];
    if (state.stores !== 1 || state.intended_store !== 1 || state.owners !== 1 || state.payment_methods !== 1) {
      fail(`seed state is ${JSON.stringify(state)}`);
    }
  }

  console.log(`Database verification passed (schema${verifySeed ? ' + idempotent seed state' : ''}).`);
} finally {
  await client.end();
}

