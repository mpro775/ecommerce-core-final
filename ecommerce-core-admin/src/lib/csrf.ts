const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER_NAME = 'x-csrf-token';

const cachedTokens = new Map<string, string>();
const tokenPromises = new Map<string, Promise<string | null>>();

function isSafeMethod(method: string | undefined): boolean {
  return SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '');
}

async function fetchCsrfToken(apiBaseUrl: string, forceRefresh = false): Promise<string | null> {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  if (forceRefresh) {
    cachedTokens.delete(normalizedApiBaseUrl);
    tokenPromises.delete(normalizedApiBaseUrl);
  }

  const cachedToken = cachedTokens.get(normalizedApiBaseUrl);
  if (cachedToken) {
    return cachedToken;
  }

  const tokenPromise = tokenPromises.get(normalizedApiBaseUrl);
  if (tokenPromise) {
    return tokenPromise;
  }

  const nextTokenPromise = (async () => {
    const response = await fetch(`${normalizedApiBaseUrl}/health/live`, {
      method: 'GET',
      credentials: 'include',
    });

    const token = response.headers.get(CSRF_HEADER_NAME);
    if (token) {
      cachedTokens.set(normalizedApiBaseUrl, token);
    }
    return token;
  })().finally(() => {
    tokenPromises.delete(normalizedApiBaseUrl);
  });

  tokenPromises.set(normalizedApiBaseUrl, nextTokenPromise);
  return nextTokenPromise;
}

export function clearCsrfTokenCache(apiBaseUrl?: string): void {
  if (!apiBaseUrl) {
    cachedTokens.clear();
    tokenPromises.clear();
    return;
  }

  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  cachedTokens.delete(normalizedApiBaseUrl);
  tokenPromises.delete(normalizedApiBaseUrl);
}

export async function attachCsrfHeader(
  apiBaseUrl: string,
  method: string | undefined,
  headers: Headers,
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  if (isSafeMethod(method) || (headers.has(CSRF_HEADER_NAME) && !options.forceRefresh)) {
    return;
  }

  const token = await fetchCsrfToken(apiBaseUrl, options.forceRefresh);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
}

export async function fetchWithCsrfRetry(
  apiBaseUrl: string,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers ?? undefined);
  await attachCsrfHeader(apiBaseUrl, method, headers);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!(await isInvalidCsrfResponse(response))) {
    return response;
  }

  clearCsrfTokenCache(apiBaseUrl);

  const retryHeaders = new Headers(init.headers ?? undefined);
  await attachCsrfHeader(apiBaseUrl, method, retryHeaders, { forceRefresh: true });

  return fetch(input, {
    ...init,
    headers: retryHeaders,
  });
}

async function isInvalidCsrfResponse(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  try {
    const raw = await response.clone().text();
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as { message?: string };
      return parsed.message === 'Invalid CSRF token';
    } catch {
      return raw.includes('Invalid CSRF token');
    }
  } catch {
    return false;
  }
}
