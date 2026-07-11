import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { createCsrfMiddleware } from './common/security/csrf.middleware';
import { createValidationException } from './common/errors/validation-error.util';
import { initSentry } from './observability/sentry.config';

function normalizeOriginHost(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: Set<string>): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  const hostname = normalizeOriginHost(origin);
  if (!hostname) {
    return false;
  }

  return (
    hostname === 'your-domain.com' ||
    hostname.endsWith('.your-domain.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

function configureSecurity(
  app: INestApplication,
  configService: ConfigService,
  logger: Logger,
): void {
  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = new Set(
    configService
      .get<string>('ALLOWED_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      callback(null, isAllowedOrigin(origin, allowedOrigins));
    },
    credentials: true,
    exposedHeaders: ['x-csrf-token'],
  });

  const csrfEnabled = configService.get<boolean>('CSRF_ENABLED', false);
  if (!csrfEnabled) {
    return;
  }

  app.use(createCsrfMiddleware());
  logger.log('CSRF protection enabled');
}

function configureSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('General Ecommerce API')
    .setDescription('General Ecommerce backend APIs')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  const jsonBodyLimit = configService.get<string>('HTTP_JSON_BODY_LIMIT', '6mb');
  app.use(json({ limit: jsonBodyLimit }));
  app.use(urlencoded({ limit: jsonBodyLimit, extended: true }));

  initSentry(app, configService);

  configureSecurity(app, configService, logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationException,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  configureSwagger(app);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : 'Failed to bootstrap app');
  process.exit(1);
});
