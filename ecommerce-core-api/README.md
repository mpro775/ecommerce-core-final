# General Ecommerce API

Backend API for the General Ecommerce Platform.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 11
- **Database:** PostgreSQL (via `pg`)
- **Cache:** Redis (via `ioredis`)
- **Message Broker:** RabbitMQ (via `amqplib`)
- **Storage:** S3-compatible (via AWS SDK)
- **Auth:** JWT + Argon2 password hashing
- **Monitoring:** Sentry

## Quick Start

```bash
npm install
cp .env.example .env   # configure your environment
npm run migrate:up
npm run seed:run
npm run dev
```

## Scripts

| Command                       | Description                      |
| ----------------------------- | -------------------------------- |
| `npm run dev`                 | Start dev server with hot reload |
| `npm run build`               | Build for production             |
| `npm run typecheck`           | Type-check without emitting      |
| `npm run lint`                | Lint source code                 |
| `npm run test`                | Run unit tests                   |
| `npm run test:e2e:smoke`      | Run e2e smoke tests              |
| `npm run migrate:up`          | Run database migrations          |
| `npm run migrate:down`        | Rollback last migration          |
| `npm run seed:run`            | Seed database                    |
| `npm run platform:seed-admin` | Seed platform admin              |
| `npm run queue:health`        | Check RabbitMQ health            |

## Workers

```bash
npm run worker:outbox            # Outbox event publisher
npm run worker:notifications     # Notification consumer
npm run worker:abandoned-carts   # Abandoned cart recovery
```

## Docker

```bash
docker build -t general-ecommerce-api .
docker run -p 3000:3000 --env-file .env general-ecommerce-api
```

## Project Structure

```
src/
├── auth/           # Authentication & authorization
├── products/       # Product catalog
├── orders/         # Order management
├── payments/       # Payment processing
├── inventory/      # Inventory & warehouses
├── customers/      # Customer management
├── shipping/       # Shipping methods
├── promotions/     # Coupons & promotions
├── themes/         # Store themes
├── domains/        # Custom domains & SSL
├── storefront/     # Storefront API
├── analytics/      # Analytics & events
├── notifications/  # Notification system
├── messaging/      # RabbitMQ messaging
├── media/          # Media & file uploads
├── saas/           # SaaS controls & billing
├── platform/       # Platform admin
├── webhooks/       # Webhook system
├── workers/        # Background workers
├── database/       # Database service
├── config/         # Configuration
├── common/         # Shared utilities & types
└── health/         # Health checks
```
