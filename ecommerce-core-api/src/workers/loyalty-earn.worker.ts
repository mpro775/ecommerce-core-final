import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LoyaltyService } from '../loyalty/loyalty.service';

const logger = new Logger('LoyaltyEarnWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const loyalty = app.get(LoyaltyService);
  const intervalMs = Number(process.env.LOYALTY_EARN_WORKER_INTERVAL_MS ?? 30_000);
  const batchSize = Number(process.env.LOYALTY_EARN_WORKER_BATCH_SIZE ?? 100);
  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const activated = await loyalty.makePendingEarnsAvailable(batchSize);
      if (activated > 0) logger.log(`Activated ${activated} pending loyalty earns`);
    } finally {
      running = false;
    }
  };
  await run();
  const timer = setInterval(() => void run().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Loyalty earn activation failed');
  }), intervalMs);
  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await app.close();
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void bootstrap();
