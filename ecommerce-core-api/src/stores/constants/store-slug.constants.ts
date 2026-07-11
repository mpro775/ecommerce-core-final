export const STORE_SLUG_MIN_LENGTH = 3;
export const STORE_SLUG_MAX_LENGTH = 50;

export const STORE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;

export const RESERVED_STORE_SUBDOMAINS = new Set([
  'api',
  'admin',
  'platform',
  'www',
  'mail',
  'smtp',
  'cdn',
  'assets',
  'static',
  'stores',
  'store',
  'checkout',
  'auth',
  'login',
  'register',
  'billing',
  'payments',
  'webhooks',
  'status',
  'blog',
  'docs',
  'dev',
  'staging',
  'prod',
  'demo',
  'ecommerce_core',
  'ecommerce_core',
]);

export function normalizeStoreSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function isReservedStoreSubdomain(slug: string): boolean {
  return RESERVED_STORE_SUBDOMAINS.has(normalizeStoreSlug(slug));
}

export function isValidStoreSlug(slug: string): boolean {
  const normalized = normalizeStoreSlug(slug);
  return STORE_SLUG_REGEX.test(normalized) && !isReservedStoreSubdomain(normalized);
}
