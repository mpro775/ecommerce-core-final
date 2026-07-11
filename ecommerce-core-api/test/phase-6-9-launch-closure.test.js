const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const apiRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(apiRoot, '..');

function read(...segments) {
  return fs.readFileSync(path.join(workspaceRoot, ...segments), 'utf8');
}

function exists(...segments) {
  return fs.existsSync(path.join(workspaceRoot, ...segments));
}

function assertContains(fileSegments, pattern, message) {
  const body = read(...fileSegments);
  assert.match(body, pattern, message ?? fileSegments.join('/'));
}

test('production environment validation rejects weak or missing critical secrets', () => {
  const { envValidationSchema } = require('../dist/config/env.validation');

  const missing = envValidationSchema.validate({ NODE_ENV: 'production' }, { abortEarly: false });
  assert(missing.error, 'production env without critical secrets must fail');
  assert.match(
    missing.error.message,
    /PLATFORM_ADMIN_SECRET|TOKEN_HASH_SECRET|JWT_ACCESS_SECRET|JWT_CUSTOMER_ACCESS_SECRET|AUTH_OTP_SECRET|WEBHOOK_SECRET|BILLING_WEBHOOK_SECRET/,
  );

  const weak = envValidationSchema.validate(
    {
      NODE_ENV: 'production',
      PLATFORM_ADMIN_SECRET: 'change-me-in-production',
      TOKEN_HASH_SECRET: 'change-me-token-hash-secret-32-chars-minimum',
      JWT_ACCESS_SECRET: 'change-me-jwt-secret',
      JWT_CUSTOMER_ACCESS_SECRET: 'change-me-customer-jwt-secret',
      AUTH_OTP_SECRET: 'change-me-otp-secret',
      WEBHOOK_SECRET: 'change-me-webhook-secret',
      BILLING_WEBHOOK_SECRET: 'change-me-billing-webhook-secret',
    },
    { abortEarly: false },
  );
  assert(weak.error, 'production env with placeholder secrets must fail');
  assert.match(weak.error.message, /contains an invalid value/);

  const strong = '0123456789abcdef0123456789abcdef';
  const valid = envValidationSchema.validate({
    NODE_ENV: 'production',
    PLATFORM_ADMIN_SECRET: `${strong}-platform`,
    TOKEN_HASH_SECRET: `${strong}-token`,
    JWT_ACCESS_SECRET: `${strong}-merchant`,
    JWT_CUSTOMER_ACCESS_SECRET: `${strong}-customer`,
    AUTH_OTP_SECRET: `${strong}-otp`,
    WEBHOOK_SECRET: `${strong}-webhook`,
    BILLING_WEBHOOK_SECRET: `${strong}-billing`,
  });
  assert.equal(valid.error, undefined);
});

test('health probes are public and include root, live, ready, detailed, version, and component checks', () => {
  const controller = read('ecommerce-core-api', 'src', 'health', 'health.controller.ts');
  for (const route of [
    "@Get('debug/version')",
    "@Get('live')",
    "@Get('ready')",
    '@Get()',
    "@Get('detail')",
    "@Get('component/:name')",
  ]) {
    assert(controller.includes(route), `missing health route ${route}`);
  }
  assert.match(controller, /@Get\('ready'\)\s+@Public\(\)/, 'readiness probe must be public');
  assert.match(controller, /@Get\(\)\s+@Public\(\)/, 'root health probe must be public');
});

test('report CSV exports require reports:export instead of broad store read permission', () => {
  const controller = read('ecommerce-core-api', 'src', 'analytics', 'analytics.controller.ts');
  for (const route of ['customers', 'sales', 'inventory']) {
    assert.match(
      controller,
      new RegExp(
        `@Get\\('reports/${route}\\.csv'\\)\\s+@RequirePermissions\\(PERMISSIONS\\.reportsExport\\)`,
      ),
      `${route} CSV export must require reports:export`,
    );
  }
});

test('storefront SEO, sitemap, robots, canonical, and page rendering contracts are wired', () => {
  assertContains(
    ['ecommerce-core-storefront', 'app', 'sitemap.ts'],
    /buildSitemapEntries/,
    'sitemap builder missing',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'sitemap.ts'],
    /listProducts/,
    'sitemap must include products source',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'sitemap.ts'],
    /listStorePages/,
    'sitemap must include store pages source',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'robots.ts'],
    /seoIndexEnabled\s*===\s*false/,
    'robots must block noindex stores',
  );
  assertContains(
    ['ecommerce-core-storefront', 'lib', 'seo', 'buildMetadata.ts'],
    /alternates/,
    'metadata must emit canonical alternates',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'products', '[slug]', 'page.tsx'],
    /buildMetadata/,
    'product page must build SEO metadata',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'categories', 'page.tsx'],
    /selectedCategoryData.*seo/s,
    'category page must use category SEO',
  );
  assertContains(
    ['ecommerce-core-storefront', 'app', 'pages', '[slug]', 'page.tsx'],
    /notFound\(\)/,
    'unpublished or missing store pages must not render publicly',
  );
});

test('templates, domains, webhooks, notifications, and analytics closure hooks exist', () => {
  assertContains(
    [
      'ecommerce-core-api',
      'src',
      'platform-admin',
      'theme-templates',
      'platform-theme-templates.controller.ts',
    ],
    /publish/,
    'platform template publish endpoint missing',
  );
  assertContains(
    [
      'ecommerce-core-api',
      'src',
      'platform-admin',
      'theme-templates',
      'platform-theme-templates.controller.ts',
    ],
    /versions\/restore/,
    'template rollback endpoint missing',
  );
  assertContains(
    [
      'ecommerce-core-api',
      'src',
      'platform-admin',
      'theme-templates',
      'platform-theme-templates.service.ts',
    ],
    /production_ready/,
    'template production readiness missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'domains', 'domains.service.ts'],
    /supportRequired/,
    'domain support queue state missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'domains', 'domains.service.ts'],
    /verificationDnsHost/,
    'domain TXT verification guidance missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'platform-admin', 'core', 'platform-core.controller.ts'],
    /domains\/issues/,
    'platform domain issues queue missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'security', 'webhook-signing.service.ts'],
    /x-webhook-signature/,
    'webhook signatures missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'webhooks', 'webhooks.controller.ts'],
    /deliveries\/:deliveryId\/retry/,
    'webhook replay/retry endpoint missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'notifications', 'notifications.gateway.ts'],
    /notification\.created/,
    'realtime notification event missing',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'analytics', 'analytics.repository.ts'],
    /product_categories/,
    'sales by category must use product_categories',
  );
  assertContains(
    ['ecommerce-core-api', 'src', 'inventory', 'inventory.repository.ts'],
    /warehouse_inventory/,
    'inventory source must be warehouse_inventory',
  );
});

test('phase 6-9 operational deliverables are present', () => {
  const requiredFiles = [
    ['docs', 'ops', 'env-vars.md'],
    ['docs', 'ops', 'backup-restore-runbook.md'],
    ['docs', 'ops', 'monitoring-logs.md'],
    ['docs', 'ops', 'docker-workers-readiness.md'],
    ['docs', 'ops', 'prelaunch-performance-smoke-test.md'],
    ['docs', 'ops', 'rollback-plan.md'],
    ['docs', 'ops', 'beta-launch-checklist.md'],
    ['docs', 'security', 'prelaunch-security-checklist.md'],
    ['docs', 'qa', 'launch-issue-register.md'],
    ['testing ecommerce_core stores', 'LAUNCH_E2E_RESULTS.md'],
  ];

  for (const file of requiredFiles) {
    assert.equal(exists(...file), true, `${file.join('/')} must exist`);
  }

  const compose = read('ecommerce_core-infra', 'docker-compose.prod.yml');
  for (const service of [
    'platform-admin',
    'worker-outbox',
    'worker-notifications',
    'worker-subscriptions',
    'worker-domain-ssl-sync',
  ]) {
    assert.match(compose, new RegExp(`\\n\\s{2}${service}:`), `compose service ${service} missing`);
  }
});
