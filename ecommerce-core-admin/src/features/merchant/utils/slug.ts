export function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function normalizeSlug(value: string): string {
  return sanitizeSlugInput(value).replace(/^-+|-+$/g, '');
}

