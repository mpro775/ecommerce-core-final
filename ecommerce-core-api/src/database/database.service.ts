import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;
  private redis: Redis;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const databaseUrl =
      this.configService?.get<string>('DATABASE_URL') ??
      process.env.DATABASE_URL ??
      'postgres://ecommerce_core:kaleem123@localhost:5432/ecommerce_core_store';

    const redisUrl =
      this.configService?.get<string>('REDIS_URL') ??
      process.env.REDIS_URL ??
      'redis://localhost:6379';

    this.pool = new Pool({ connectionString: databaseUrl });
    this.redis = new Redis(redisUrl, { lazyConnect: true });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  async pingPostgres(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async pingRedis(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    await this.redis.ping();
  }

  get db(): Pool {
    const pool = this.pool;

    const originalQuery = pool.query.bind(pool);

    if (!(pool as any).__debugWrapped) {
      (pool as any).query = async (text: string, values?: unknown[]) => {
        try {
          return await originalQuery(text, values);
        } catch (error) {
          console.error('[PG QUERY ERROR]', {
            message: error instanceof Error ? error.message : String(error),
            text,
            values,
            valuesLength: values?.length,
          });
          throw error;
        }
      };

      (pool as any).__debugWrapped = true;
    }

    return pool;
  }

  get cache(): Redis {
    return this.redis;
  }
}
