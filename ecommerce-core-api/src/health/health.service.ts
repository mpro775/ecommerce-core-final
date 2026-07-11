import { Inject, Injectable } from '@nestjs/common';
import type { HealthStatus } from '../common/types/shared.types';
import { DatabaseService } from '../database/database.service';
import { STORAGE_ADAPTER, type StorageAdapter } from '../media/storage.adapter';
import { MESSAGE_PUBLISHER, type MessagePublisher } from '../messaging/publisher.interface';

export interface DetailedHealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  checks: Record<string, HealthStatus>;
}

export interface ComponentHealth {
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private readonly version = '1.0.0';

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  getLive(): { status: HealthStatus; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady(): Promise<{
    status: HealthStatus;
    timestamp: string;
    checks: Record<string, HealthStatus>;
  }> {
    const checks: Record<string, HealthStatus> = {
      postgres: 'down',
      redis: 'down',
      rabbitmq: 'down',
      storage: 'down',
    };

    try {
      await this.databaseService.pingPostgres();
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'down';
    }

    try {
      await this.databaseService.pingRedis();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'down';
    }

    checks.rabbitmq = (await this.publisher.ping()) ? 'ok' : 'down';

    const storageHealth = await this.checkStorage();
    checks.storage = storageHealth.status;

    const status: HealthStatus = Object.values(checks).every((value) => value === 'ok')
      ? 'ok'
      : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getDetailed(): Promise<DetailedHealthResponse> {
    const checks: Record<string, HealthStatus> = {};

    const postgresHealth = await this.checkPostgres();
    checks.postgres = postgresHealth.status;

    const redisHealth = await this.checkRedis();
    checks.redis = redisHealth.status;

    const rabbitmqHealth = await this.checkRabbitMQ();
    checks.rabbitmq = rabbitmqHealth.status;

    const storageHealth = await this.checkStorage();
    checks.storage = storageHealth.status;

    const allStatuses = Object.values(checks);
    let overallStatus: HealthStatus = 'ok';
    if (allStatuses.some((s) => s === 'down')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: this.getMemoryUsage(),
      checks,
    };
  }

  async getComponentHealth(component: string): Promise<ComponentHealth> {
    switch (component) {
      case 'postgres':
        return this.checkPostgres();
      case 'redis':
        return this.checkRedis();
      case 'rabbitmq':
        return this.checkRabbitMQ();
      case 'storage':
        return this.checkStorage();
      default:
        return { status: 'down', message: `Unknown component: ${component}` };
    }
  }

  private async checkStorage(): Promise<ComponentHealth> {
    const start = Date.now();
    const probeKey = `__health__/probe-${Date.now()}`;

    try {
      await this.storageAdapter.headObject(probeKey);
      return {
        status: 'ok',
        latency: Date.now() - start,
        details: {
          bucketName: this.storageAdapter.getBucketName(),
          probeKey,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Storage health check failed',
      };
    }
  }

  private async checkPostgres(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.databaseService.pingPostgres();
      return {
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'PostgreSQL connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.databaseService.pingRedis();
      return {
        status: 'ok',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkRabbitMQ(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const isHealthy = await this.publisher.ping();
      return {
        status: isHealthy ? 'ok' : 'down',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'RabbitMQ connection failed',
      };
    }
  }

  private getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number; rss: number } {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    };
  }
}
