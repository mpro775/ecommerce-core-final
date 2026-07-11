import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AbandonedCartsService } from '../customers/abandoned-carts.service';

const logger = new Logger('AbandonedCartsWorker');

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const abandonedCartsService = app.get(AbandonedCartsService);

  const intervalMs = Math.max(
    15_000,
    configService.get<number>('ABANDONED_CART_WORKER_INTERVAL_MS', 60_000),
  );

  const runCycle = async () => {
    const startedAt = Date.now();
    try {
      const capture = await abandonedCartsService.captureAbandonedCarts();
      const dispatch = await abandonedCartsService.dispatchRecoveryEmails();
      const tookMs = Date.now() - startedAt;
      logger.log(
        `Cycle completed in ${tookMs}ms. captured=${capture.captured}/${capture.scanned}, sent=${dispatch.sent}, failed=${dispatch.failed}`,
      );
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Failed to process abandoned carts cycle',
      );
    }
  };

  await runCycle();
  const timer = setInterval(() => {
    void runCycle();
  }, intervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    await app.close();
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });

  logger.log(`Abandoned carts worker is running. intervalMs=${intervalMs}`);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Failed to start abandoned carts worker');
    process.exit(1);
  });
}
