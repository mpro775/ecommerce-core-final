import * as Sentry from '@sentry/nestjs';
import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export function initSentry(app: INestApplication, configService: ConfigService): void {
  const dsn = configService.get<string>('SENTRY_DSN');
  const environment = configService.get<string>('NODE_ENV', 'development');
  const release = configService.get<string>('SENTRY_RELEASE', '0.1.0');

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [
      Sentry.captureConsoleIntegration({
        levels: ['error', 'warn'],
      }),
      Sentry.extraErrorDataIntegration(),
      Sentry.httpIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    sendDefaultPii: false,
  });
}

export function setSentryUser(user: { id: string; storeId?: string; role?: string }): void {
  Sentry.setUser({
    id: user.id,
    storeId: user.storeId,
    role: user.role,
  } as Sentry.User);
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

export function captureException(error: Error, context?: Record<string, unknown>): string {
  return Sentry.captureException(error, {
    extra: context ?? {},
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
  return Sentry.captureMessage(message, level);
}

export function addSentryBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}

export function setSentryTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

export function setSentryContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}
