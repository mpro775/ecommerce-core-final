import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { StoresRepository, type StorePublicRecord } from '../stores/stores.repository';

@Injectable()
export class StoreResolverService {
  private readonly cacheTtlSeconds = 300;

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  async resolve(_request: Request): Promise<StorePublicRecord> {
    const cacheKey = 'store:default_active';
    const fromCache = await this.resolveFromCache(cacheKey);
    if (fromCache) {
      this.assertStoreIsActive(fromCache);
      return fromCache;
    }

    const store = await this.storesRepository.findFirstActiveStore();
    if (!store) {
      throw new NotFoundException('No active store found');
    }

    this.assertStoreIsActive(store);

    await this.cacheStore(cacheKey, store.id);
    return store;
  }

  private async resolveFromCache(key: string): Promise<StorePublicRecord | null> {
    try {
      await this.databaseService.pingRedis();
      const storeId = await this.databaseService.cache.get(key);
      if (!storeId) {
        return null;
      }

      return this.storesRepository.findPublicById(storeId);
    } catch {
      return null;
    }
  }

  private async cacheStore(key: string, storeId: string): Promise<void> {
    try {
      await this.databaseService.pingRedis();
      await this.databaseService.cache.set(key, storeId, 'EX', this.cacheTtlSeconds);
    } catch {
      return;
    }
  }

  private assertStoreIsActive(store: StorePublicRecord): void {
    if (store.status === 'deleted') {
      throw new NotFoundException('Store not found');
    }
    if (store.is_suspended) {
      throw new ForbiddenException('Store is suspended');
    }
  }
}
