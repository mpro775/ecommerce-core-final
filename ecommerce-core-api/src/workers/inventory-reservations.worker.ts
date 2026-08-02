import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InventoryService } from '../inventory/inventory.service';
import { DatabaseService } from '../database/database.service';

const logger = new Logger('InventoryReservationsWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const inventory = app.get(InventoryService);
  const database = app.get(DatabaseService);
  const intervalMs = Number(process.env.INVENTORY_RESERVATION_WORKER_INTERVAL_MS ?? 30_000);

  const run = async (): Promise<void> => {
    const stores = await database.db.query<{ id: string }>('SELECT id FROM stores');
    for (const store of stores.rows) {
      const released = await inventory.releaseExpiredReservations(store.id);
      if (released > 0) logger.log(`Expired ${released} reservations for store ${store.id}`);
    }
  };

  await run();
  const timer = setInterval(() => void run().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Reservation expiration failed');
  }), intervalMs);
  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await app.close();
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void bootstrap();
