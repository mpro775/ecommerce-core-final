const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, it } = require('node:test');

const root = join(__dirname, '..');

describe('Phase 1/2 single-store cleanup contract', () => {
  it('has no deleted SaaS/readiness modules or admin routes in backend source', () => {
    for (const path of [
      'src/store-capabilities/store-capabilities.module.ts',
      'src/store-capabilities/store-capabilities.service.ts',
      'src/store-readiness/store-readiness.module.ts',
      'src/store-readiness/store-readiness.controller.ts',
    ]) {
      assert.equal(existsSync(join(root, path)), false, path);
    }
    const appModule = readFileSync(join(root, 'src/app.module.ts'), 'utf8');
    assert.doesNotMatch(appModule, /StoreCapabilities|StoreReadiness/);
  });

  it('keeps migration transaction ownership in the runner and 098 unique', () => {
    for (const name of [
      '091_drop_saas_platform_qa_tables.up.sql',
      '092_drop_web_builder_theme_domain_tables.up.sql',
      '098_single_store_saas_visual_cleanup.up.sql',
    ]) {
      const sql = readFileSync(join(root, 'migrations', name), 'utf8');
      assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/imu, name);
    }
  });

  it('seeds only final-schema operational settings and catalog payment naming', () => {
    const seed = readFileSync(join(root, 'seeds/002_seed_single_store.sql'), 'utf8');
    assert.match(seed, /متجر النجوم تليكوم/);
    assert.match(seed, /payment_method_catalog_id/);
    assert.doesNotMatch(seed, /currency_settings|profile_settings|enabledFeatures/);
    assert.doesNotMatch(seed, /platform_payment_method_id|store_themes|store_domains|store_pages/);
  });

  it('uses payment catalog terminology in active payment contracts', () => {
    const service = readFileSync(join(root, 'src/payment-methods/payment-methods.service.ts'), 'utf8');
    assert.match(service, /catalogMethod/);
    assert.doesNotMatch(service, /platformMethod|PlatformPaymentMethod|platformPaymentMethodId/);
  });
});

