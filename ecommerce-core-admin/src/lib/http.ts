import { fetchWithCsrfRetry } from './csrf';
import { parseApiError } from './api-error';

export async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<T | null> {
  let apiBaseUrl: string | null = null;
  try {
    const parsedUrl = new URL(url, window.location.origin);
    apiBaseUrl = parsedUrl.origin;
  } catch {
    // Ignore URL parsing errors and continue request without CSRF header.
  }

  const response = apiBaseUrl
    ? await fetchWithCsrfRetry(apiBaseUrl, url, {
        ...init,
        credentials: 'include',
      })
    : await fetch(url, {
        ...init,
        credentials: 'include',
      });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
}

