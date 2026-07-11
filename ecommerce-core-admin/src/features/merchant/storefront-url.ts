const DEFAULT_STOREFRONT_URL_PATTERN = 'https://{storeSlug}.your-domain.com';

export function buildStorefrontVisitUrl(
  apiBaseUrl: string,
  storeSlug: string | null | undefined,
): string | null {
  const normalizedStoreSlug = storeSlug?.trim();
  if (!normalizedStoreSlug) {
    return null;
  }

  const configured = import.meta.env.VITE_STOREFRONT_URL_PATTERN ?? import.meta.env.VITE_STOREFRONT_BASE_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    const configuredBase = configured.trim();
    if (configuredBase.includes('{storeSlug}')) {
      return configuredBase.replace('{storeSlug}', encodeURIComponent(normalizedStoreSlug));
    }

    return appendStoreSlugQuery(configuredBase, normalizedStoreSlug);
  }

  return resolveStorefrontBaseUrl(apiBaseUrl, normalizedStoreSlug);
}

function resolveStorefrontBaseUrl(apiBaseUrl: string, storeSlug: string): string {
  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = '3001';
      url.pathname = '/';
      url.search = '';
      url.hash = '';
      return trimTrailingSlash(url.toString());
    }

    if (url.hostname.startsWith('api.')) {
      url.hostname = `${storeSlug}.${url.hostname.slice(4)}`;
      url.port = '';
      url.pathname = '/';
      url.search = '';
      url.hash = '';
      return trimTrailingSlash(url.toString());
    }
  } catch {
    return DEFAULT_STOREFRONT_URL_PATTERN.replace('{storeSlug}', encodeURIComponent(storeSlug));
  }

  return DEFAULT_STOREFRONT_URL_PATTERN.replace('{storeSlug}', encodeURIComponent(storeSlug));
}

function appendStoreSlugQuery(baseUrl: string, storeSlug: string): string {
  try {
    const url = new URL(baseUrl);
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== 'stores.your-domain.com') {
      return trimTrailingSlash(url.toString());
    }
    url.searchParams.set('store', storeSlug);
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${trimTrailingSlash(baseUrl)}${separator}store=${encodeURIComponent(storeSlug)}`;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
