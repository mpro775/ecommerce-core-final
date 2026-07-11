const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('store resolver prefers explicit store slug before host cache', () => {
  const source = readFileSync('src/storefront/store-resolver.service.ts', 'utf8');

  assert.match(source, /getAllowedExplicitSlugFromRequest\(request, hostname\)/);
  assert.match(source, /query\.store/);
  assert.match(source, /header\('x-store-slug'\)/);
  assert.match(source, /cacheKeyForSlug\(explicitSlug\)/);
  assert.match(
    source,
    /shouldTryCustomDomain\s*\?\s*await this\.storesRepository\.findPublicByHostname/,
  );
});
