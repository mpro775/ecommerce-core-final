import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WebhooksService } from '../webhooks/webhooks.service';

const logger = new Logger('WebhookDeliveryWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const webhooks = app.get(WebhooksService);
  const intervalMs = Number(process.env.WEBHOOK_WORKER_INTERVAL_MS ?? 2000);
  const batchSize = Number(process.env.WEBHOOK_BATCH_SIZE ?? 50);
  let lastRecoveryAt = 0;

  const run = async (): Promise<void> => {
    if (Date.now() - lastRecoveryAt >= Math.max(intervalMs, 30_000)) {
      const recovered = await webhooks.recoverStaleProcessing();
      lastRecoveryAt = Date.now();
      if (recovered > 0) logger.warn(`Recovered stale webhook deliveries: ${recovered}`);
    }
    const processed = await webhooks.processDueDeliveries(batchSize);
    if (processed > 0) logger.log(`Processed webhook deliveries: ${processed}`);
  };

  await run();
  const interval = setInterval(() => {
    run().catch((error: unknown) => {
      logger.error(error instanceof Error ? error.message : 'Unknown webhook worker error');
    });
  }, intervalMs);

  const shutdown = async (): Promise<void> => {
    clearInterval(interval);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : 'Failed to start webhook worker');
  process.exit(1);
});

