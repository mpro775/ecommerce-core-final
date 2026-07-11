import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

interface ErrorContext {
  userId?: string;
  storeId?: string;
  requestId?: string;
  [key: string]: unknown;
}

@Injectable()
export class SentryService {
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get<string>('NODE_ENV', 'development');
  }

  captureException(error: Error, context?: ErrorContext): string {
    if (context?.requestId) {
      Sentry.setTag('request_id', context.requestId);
    }
    if (context?.storeId) {
      Sentry.setTag('store_id', context.storeId);
    }
    if (context?.userId) {
      Sentry.setUser({ id: context.userId } as Sentry.User);
    }

    const { userId, storeId, requestId, ...extra } = context || {};

    return Sentry.captureException(error, {
      extra: extra ?? {},
    });
  }

  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: ErrorContext,
  ): string {
    if (context?.requestId) {
      Sentry.setTag('request_id', context.requestId);
    }
    if (context?.storeId) {
      Sentry.setTag('store_id', context.storeId);
    }

    return Sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; storeId?: string; role?: string; email?: string }): void {
    const sentryUser: Record<string, string> = { id: user.id };
    if (user.storeId) sentryUser.storeId = user.storeId;
    if (user.role) sentryUser.role = user.role;
    if (user.email) sentryUser.email = user.email;
    Sentry.setUser(sentryUser as Sentry.User);
  }

  clearUser(): void {
    Sentry.setUser(null);
  }

  setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  setContext(name: string, context: Record<string, unknown>): void {
    Sentry.setContext(name, context);
  }

  addBreadcrumb(breadcrumb: {
    category?: string;
    message?: string;
    level?: Sentry.SeverityLevel;
    data?: Record<string, unknown>;
  }): void {
    const b: Sentry.Breadcrumb = {
      level: breadcrumb.level || 'info',
    };
    if (breadcrumb.category) b.category = breadcrumb.category;
    if (breadcrumb.message) b.message = breadcrumb.message;
    if (breadcrumb.data) b.data = breadcrumb.data;
    Sentry.addBreadcrumb(b);
  }

  withScope<T>(callback: (scope: Sentry.Scope) => T): T {
    return Sentry.withScope(callback);
  }

  captureRequestError(error: Error, request: Request, context?: ErrorContext): string {
    return this.withScope((scope) => {
      scope.setTag('method', request.method);
      scope.setTag('url', request.url);
      scope.setExtra('headers', this.sanitizeHeaders(request.headers));
      scope.setExtra('query', request.query);

      return this.captureException(error, context);
    });
  }

  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
