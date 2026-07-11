import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function resolveRequestToken(req: Request): string {
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  if (tokenFromCookie && tokenFromCookie.length > 0) {
    return tokenFromCookie;
  }

  return randomUUID();
}

export function createCsrfMiddleware(): RequestHandler {
  return (req: Request, res: Response, next): void => {
    const csrfToken = resolveRequestToken(req);

    if (req.cookies?.[CSRF_COOKIE_NAME] !== csrfToken) {
      setCsrfCookie(res, csrfToken);
    }

    res.setHeader(CSRF_HEADER_NAME, csrfToken);

    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const tokenFromHeader = req.header(CSRF_HEADER_NAME);
    if (!tokenFromHeader || csrfToken !== tokenFromHeader) {
      res.status(403).json({
        statusCode: 403,
        message: 'Invalid CSRF token',
      });
      return;
    }

    next();
  };
}
