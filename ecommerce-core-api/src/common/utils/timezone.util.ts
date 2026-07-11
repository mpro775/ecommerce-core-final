export function parseIanaTimezone(input: string): string | null {
  const candidate = input.trim();
  if (candidate.length === 0) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
