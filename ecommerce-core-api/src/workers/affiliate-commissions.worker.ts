import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AppModule } from '../app.module';

const logger = new Logger('AffiliateCommissionsWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const affiliates = app.get(AffiliatesService);
  const intervalMs = Number(process.env.AFFILIATE_COMMISSION_WORKER_INTERVAL_MS ?? 60_000);
  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const advanced = await affiliates.advancePayableCommissions();
      if (advanced > 0) logger.log(`Advanced ${advanced} commissions to payable`);
    } finally {
      running = false;
    }
  };
  await run();
  const timer = setInterval(() => void run().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Commission lifecycle failed');
  }), intervalMs);
  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await app.close();
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void bootstrap();
