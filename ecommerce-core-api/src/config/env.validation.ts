import Joi from 'joi';

const WEAK_SECRET_VALUES = [
  'change-me',
  'change-me-in-production',
  'change-me-jwt-secret',
  'change-me-customer-jwt-secret',
  'change-me-otp-secret',
  'change-me-webhook-secret',
  'ecommerce_core-local-platform-secret',
  'ecommerce_core-local-access-secret-change-me',
  'ecommerce_core-local-customer-access-secret-change-me',
  'ecommerce_core-local-owner-registration-otp-secret-change-me',
  'ecommerce_core-local-token-hash-secret-change-me',
  'ecommerce_core-local-webhook-secret',
  'ecommerce_core-local-billing-webhook-secret',
];

function productionSecret(min: number, developmentDefault: string): Joi.Schema {
  return Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .min(min)
      .invalid(...WEAK_SECRET_VALUES)
      .required(),
    otherwise: Joi.string().min(Math.min(min, 16)).default(developmentDefault),
  });
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  HTTP_JSON_BODY_LIMIT: Joi.string().default('6mb'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .default('postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store'),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis'] })
    .default('redis://localhost:6379'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: Joi.string().default('commerce.events'),
  NOTIFICATIONS_MAIN_QUEUE: Joi.string().default('notifications.order-events'),
  NOTIFICATIONS_DLQ_QUEUE: Joi.string().default('notifications.order-events.dlq'),
  NOTIFICATIONS_RETRY_CREATED_QUEUE: Joi.string().default('notifications.order-created.retry'),
  NOTIFICATIONS_RETRY_STATUS_QUEUE: Joi.string().default('notifications.order-status.retry'),
  NOTIFICATIONS_RETRY_INVENTORY_QUEUE: Joi.string().default('notifications.inventory.retry'),
  NOTIFICATIONS_MAX_RETRIES: Joi.number().integer().min(0).max(20).default(3),
  NOTIFICATIONS_RETRY_DELAY_MS: Joi.number().integer().min(100).max(300_000).default(10_000),
  NOTIFICATIONS_RABBITMQ_CONNECT_MAX_ATTEMPTS: Joi.number().integer().min(1).max(120).default(20),
  NOTIFICATIONS_RABBITMQ_CONNECT_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(250)
    .max(60_000)
    .default(3_000),
  INVENTORY_RESERVATION_TTL_MINUTES: Joi.number().integer().min(1).max(120).default(15),
  THEME_PREVIEW_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).max(240).default(30),
  TEMPLATE_PREVIEW_STORE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/preview'),
  TEMPLATE_PREVIEW_TOKEN_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(60),
  DOMAIN_VERIFY_TXT_PREFIX: Joi.string().default('_kaleem-verify'),
  DOMAIN_CNAME_TARGET: Joi.string().default('stores.example.com'),
  DOMAIN_SSL_PROVIDER: Joi.string().valid('manual', 'cloudflare').default('manual'),
  DOMAIN_SSL_MODE: Joi.string().valid('full', 'full_strict').default('full_strict'),
  CLOUDFLARE_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://api.cloudflare.com/client/v4'),
  CLOUDFLARE_API_TOKEN: Joi.string().allow('').default(''),
  CLOUDFLARE_ZONE_ID: Joi.string().allow('').default(''),
  CLOUDFLARE_SSL_VALIDATION_METHOD: Joi.string().valid('txt', 'http').default('txt'),
  CLOUDFLARE_MIN_TLS_VERSION: Joi.string().valid('1.2', '1.3').default('1.2'),
  CLOUDFLARE_TLS_CIPHERS: Joi.string().allow('').default(''),
  DOMAIN_SSL_SYNC_INTERVAL_MS: Joi.number().integer().min(60_000).max(3_600_000).default(300_000),
  DOMAIN_SSL_SYNC_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(100),
  PLATFORM_ADMIN_SECRET: productionSecret(32, 'ecommerce_core-local-platform-secret'),
  TOKEN_HASH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .min(32)
      .invalid(...WEAK_SECRET_VALUES)
      .required(),
    otherwise: Joi.string().min(24).default('ecommerce_core-local-token-hash-secret-change-me'),
  }),
  JWT_ACCESS_SECRET: productionSecret(32, 'ecommerce_core-local-access-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:9000'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().default('commerce-media'),
  S3_ACCESS_KEY: Joi.string().default('minio'),
  S3_SECRET_KEY: Joi.string().default('minio123'),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(true),
  S3_PUBLIC_BASE_URL: Joi.string().allow('').default('http://localhost:9000/commerce-media'),
  S3_PRESIGNED_PUT_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  S3_PRESIGNED_GET_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(600),
  ALLOWED_ORIGINS: Joi.string().allow('').default(''),
  CSRF_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().default(true),
    otherwise: Joi.boolean().default(false),
  }),
  SENTRY_DSN: Joi.string().allow('').default(''),
  SENTRY_RELEASE: Joi.string().default('0.1.0'),
  METRICS_PREFIX: Joi.string().default('ecommerce_core_'),
  CORS_CACHE_TTL_MS: Joi.number().integer().min(1000).max(600_000).default(60_000),
  CORS_CACHE_REFRESH_INTERVAL_MS: Joi.number().integer().min(1000).max(300_000).default(30_000),
  AUTH_MAX_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
  AUTH_LOCKOUT_DURATION_MS: Joi.number().integer().min(60_000).max(3600_000).default(900_000),
  AUTH_WINDOW_MS: Joi.number().integer().min(60_000).max(3600_000).default(900_000),
  AUTH_OTP_SECRET: productionSecret(32, 'ecommerce_core-local-owner-registration-otp-secret-change-me'),
  AUTH_OTP_TTL_MINUTES: Joi.number().integer().min(3).max(30).default(10),
  AUTH_OTP_MAX_VERIFY_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  AUTH_OTP_RESEND_COOLDOWN_SECONDS: Joi.number().integer().min(30).max(600).default(60),
  AUTH_OTP_MAX_RESEND_COUNT: Joi.number().integer().min(1).max(20).default(5),
  EMAIL_DELIVERY_MODE: Joi.string().valid('log', 'resend', 'smtp').default('log'),
  EMAIL_FROM: Joi.string()
    .email({ tlds: { allow: false } })
    .default('no-reply@ecommerce_core.store'),
  SMTP_HOST: Joi.when('EMAIL_DELIVERY_MODE', {
    is: 'smtp',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  SMTP_PORT: Joi.when('EMAIL_DELIVERY_MODE', {
    is: 'smtp',
    then: Joi.number().integer().min(1).max(65535).required(),
    otherwise: Joi.number().integer().min(1).max(65535).default(465),
  }),
  SMTP_SECURE: Joi.boolean().default(true),
  SMTP_USER: Joi.when('EMAIL_DELIVERY_MODE', {
    is: 'smtp',
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  SMTP_PASS: Joi.when('EMAIL_DELIVERY_MODE', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  RESEND_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://api.resend.com'),
  RESEND_API_KEY: Joi.string().allow('').default(''),
  WEBHOOK_SECRET: productionSecret(32, 'ecommerce_core-local-webhook-secret'),
  BILLING_WEBHOOK_SECRET: productionSecret(32, 'ecommerce_core-local-billing-webhook-secret'),
  JWT_CUSTOMER_ACCESS_SECRET: productionSecret(32, 'ecommerce_core-local-customer-access-secret-change-me'),
  JWT_CUSTOMER_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  CUSTOMER_REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  CUSTOMER_PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(1).max(1440).default(60),
  API_PUBLIC_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  STOREFRONT_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001'),
  MERCHANT_ADMIN_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:5173'),
  RESTOCK_CONVERSION_WINDOW_DAYS: Joi.number().integer().min(1).max(30).default(7),
  RESTOCK_NOTIFICATION_COOLDOWN_HOURS: Joi.number().integer().min(1).max(168).default(6),
  ABANDONED_CART_INACTIVITY_MINUTES: Joi.number()
    .integer()
    .min(15)
    .max(7 * 24 * 60)
    .default(60),
  ABANDONED_CART_CAPTURE_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(200),
  ABANDONED_CART_REMINDER_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(100),
  ABANDONED_CART_REMINDER_COOLDOWN_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(14 * 24)
    .default(24),
  ABANDONED_CART_WORKER_INTERVAL_MS: Joi.number()
    .integer()
    .min(15_000)
    .max(60 * 60 * 1000)
    .default(60_000),
});
