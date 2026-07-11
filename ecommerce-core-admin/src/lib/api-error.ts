export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;
  readonly requestId: string | null | undefined;
  readonly fieldErrors: ApiFieldErrors;

  constructor(input: {
    message: string;
    statusCode: number;
    code?: string | undefined;
    requestId?: string | null | undefined;
    fieldErrors?: ApiFieldErrors;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.requestId = input.requestId;
    this.fieldErrors = input.fieldErrors ?? {};
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function parseApiError(response: Response): Promise<ApiError> {
  const fallbackMessage = `Request failed with status ${response.status}`;
  const raw = await response.text();
  if (!raw) {
    return new ApiError({ message: fallbackMessage, statusCode: response.status });
  }

  try {
    const parsed = JSON.parse(raw) as {
      statusCode?: unknown;
      code?: unknown;
      message?: unknown;
      requestId?: unknown;
      errors?: unknown;
    };
    return new ApiError({
      message: normalizeMessage(parsed.message, fallbackMessage),
      statusCode: normalizeStatusCode(parsed.statusCode, response.status),
      code: typeof parsed.code === 'string' ? parsed.code : undefined,
      requestId:
        typeof parsed.requestId === 'string' || parsed.requestId === null
          ? parsed.requestId
          : undefined,
      fieldErrors: normalizeFieldErrors(parsed.errors),
    });
  } catch {
    return new ApiError({ message: raw, statusCode: response.status });
  }
}

export function firstFieldError(fieldErrors: ApiFieldErrors, fields: string[]): string | undefined {
  for (const field of fields) {
    const messages = fieldErrors[field];
    if (messages?.[0]) {
      return messages[0];
    }
  }
  return undefined;
}

export function mapFieldErrors(
  fieldErrors: ApiFieldErrors,
  fields: Record<string, string[]>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields)
      .map(([formField, apiFields]) => [formField, firstFieldError(fieldErrors, apiFields)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function clearFieldErrors(
  current: Record<string, string>,
  fields: string[],
): Record<string, string> {
  if (fields.every((field) => !current[field])) {
    return current;
  }

  const next = { ...current };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

function normalizeMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join('; ') || fallback;
  }
  return fallback;
}

function normalizeStatusCode(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeFieldErrors(value: unknown): ApiFieldErrors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([field, messages]) => {
      if (!Array.isArray(messages)) {
        return [];
      }
      const normalized = messages.filter((message): message is string => typeof message === 'string');
      return normalized.length > 0 ? [[field, normalized] as const] : [];
    }),
  );
}
