import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';
import { PaymentTransitionService } from '../payments/payment-transition.service';

const logger = new Logger('PaymentExpirationWorker');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error','warn','log'] });
  const database = app.get(DatabaseService);
  const transitions = app.get(PaymentTransitionService);
  const workerId = `payment-expiry-${process.pid}-${randomUUID()}`;
  const intervalMs = Number(process.env.PAYMENT_EXPIRATION_WORKER_INTERVAL_MS ?? 30_000);
  const batchSize = Number(process.env.PAYMENT_EXPIRATION_BATCH_SIZE ?? 50);

  const run = async () => {
    const client = await database.db.connect();
    let claimed: Array<{ id: string; store_id: string; version: string }> = [];
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; store_id: string; version: string }>(
        `WITH due AS (
           SELECT id FROM payments
           WHERE status IN ('pending','submitted') AND expires_at <= NOW()
             AND (expiration_claimed_at IS NULL OR expiration_claimed_at < NOW() - INTERVAL '5 minutes')
           ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT $1
         ) UPDATE payments p SET expiration_claimed_at=NOW(),expiration_claimed_by=$2
           FROM due WHERE p.id=due.id RETURNING p.id,p.store_id,p.version::text`, [batchSize,workerId]);
      claimed = result.rows;
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    for (const row of claimed) {
      try {
        await transitions.execute({paymentId:row.id,storeId:row.store_id,command:'expirePayment',
          expectedVersion:Number(row.version),idempotencyKey:`payment-expire-${row.id}`,
          actor:{id:null,type:'worker',permissions:['payments:expire']},
          context:{requestId:workerId}});
      } catch (error) {
        await database.db.query(
          `UPDATE payments SET expiration_claimed_at=NULL,expiration_claimed_by=NULL
           WHERE id=$1 AND expiration_claimed_by=$2`,[row.id,workerId]);
        logger.warn(error instanceof Error ? error.message : 'Payment expiration failed');
      }
    }
    if (claimed.length) logger.log(`Claimed ${claimed.length} expired payments`);
  };
  await run();
  const timer=setInterval(()=>void run().catch((error:unknown)=>logger.error(
    error instanceof Error?error.message:'Payment expiration worker failure')),intervalMs);
  const shutdown=async()=>{clearInterval(timer);await app.close();process.exit(0);};
  process.on('SIGINT',()=>void shutdown()); process.on('SIGTERM',()=>void shutdown());
}
bootstrap().catch((error:unknown)=>{logger.error(error instanceof Error?error.message:'Worker startup failed');process.exit(1);});
