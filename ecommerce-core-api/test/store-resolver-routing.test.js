const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('store resolver always resolves the single default active store', () => {
  const source = readFileSync('src/storefront/store-resolver.service.ts', 'utf8');

  assert.match(source, /store:default_active/);
  assert.match(source, /findFirstActiveStore\(\)/);
  assert.doesNotMatch(source, /x-store-slug|findPublicByHostname|query\.store|subdomain/i);
});
