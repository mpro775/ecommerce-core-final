import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { OutboxService } from '../messaging/outbox.service';

const logger = new Logger('OutboxWorker');
const pollIntervalMs = 2000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const outboxService = app.get(OutboxService);

  const run = async (): Promise<void> => {
    const publishedCount = await outboxService.publishPending(100);
    if (publishedCount > 0) {
      logger.log(`Published outbox messages: ${publishedCount}`);
    }
  };

  await run();
  const interval = setInterval(() => {
    run().catch((error: unknown) => {
      logger.error(error instanceof Error ? error.message : 'Unknown outbox worker error');
    });
  }, pollIntervalMs);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    clearInterval(interval);
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : 'Failed to start outbox worker');
  process.exit(1);
});
