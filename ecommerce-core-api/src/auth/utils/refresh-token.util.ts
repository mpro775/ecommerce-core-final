import { randomBytes } from 'node:crypto';

export interface ParsedRefreshToken {
  sessionId: string;
  secret: string;
}

export function buildRefreshToken(sessionId: string): ParsedRefreshToken & { token: string } {
  const secret = randomBytes(32).toString('base64url');
  return {
    sessionId,
    secret,
    token: `${sessionId}.${secret}`,
  };
}

export function parseRefreshToken(token: string): ParsedRefreshToken | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [sessionId, secret] = parts;
  if (!sessionId || !secret) {
    return null;
  }

  return {
    sessionId,
    secret,
  };
}
