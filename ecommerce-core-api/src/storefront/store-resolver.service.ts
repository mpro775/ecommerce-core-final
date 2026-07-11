import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import {
  isReservedStoreSubdomain,
  isValidStoreSlug,
  normalizeStoreSlug,
} from '../stores/constants/store-slug.constants';
import { StoresRepository, type StorePublicRecord } from '../stores/stores.repository';

@Injectable()
export class StoreResolverService {
  private readonly cacheTtlSeconds = 300;

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async resolve(request: Request): Promise<StorePublicRecord> {
    const hostname = this.getHost(request);
    const explicitSlug = this.getAllowedExplicitSlugFromRequest(request, hostname);
    const extractedSlug = explicitSlug ? null : this.extractDefaultSubdomainSlug(hostname);
    const cacheKey = explicitSlug
      ? this.cacheKeyForSlug(explicitSlug)
      : this.cacheKeyForHost(hostname);
    const fromCache = await this.resolveFromCache(cacheKey);
    if (fromCache) {
      this.assertStoreIsActive(fromCache);
      return fromCache;
    }

    const shouldTryCustomDomain = !explicitSlug && !this.isRootDomainHost(hostname);
    const byDomain = shouldTryCustomDomain
      ? await this.storesRepository.findPublicByHostname(hostname)
      : null;
    if (byDomain) {
      this.assertStoreIsActive(byDomain);
      await this.cacheStore(cacheKey, byDomain.id);
      return byDomain;
    }

    const slug = explicitSlug ?? extractedSlug;
    if (!slug) {
      throw new NotFoundException('Store not found for current host');
    }

    const store = await this.storesRepository.findBySlug(slug);
    if (!store) {
      throw new NotFoundException('Store not found for current host');
    }

    this.assertStoreIsActive(store);

    await this.cacheStore(cacheKey, store.id);
    return store;
  }

  private getHost(request: Request): string {
    const forwardedHost = request.header('x-storefront-host') ?? request.header('x-forwarded-host');
    const host = this.normalizeForwardedHost(forwardedHost) ?? request.header('host');
    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    const hostname = this.normalizeHostname(host);
    if (!hostname) {
      throw new BadRequestException('Host header is invalid');
    }

    return hostname;
  }

  private getAllowedExplicitSlugFromRequest(request: Request, host: string): string | null {
    if (!this.allowsExplicitSlug(host)) {
      return null;
    }

    const queryStore = typeof request.query.store === 'string' ? request.query.store : null;
    const headerStore = request.header('x-store-slug');
    const explicitSlug = queryStore?.trim() || headerStore?.trim() || '';
    if (!explicitSlug) {
      return null;
    }

    const normalized = normalizeStoreSlug(explicitSlug);
    if (!isValidStoreSlug(normalized)) {
      throw new NotFoundException('Store not found for current host');
    }

    return normalized;
  }

  private normalizeForwardedHost(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const first = value.split(',')[0]?.trim();
    if (!first) {
      return null;
    }

    return first;
  }

  private normalizeHostname(value: string): string {
    const withoutProtocol = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const withoutPath = withoutProtocol.split('/')[0] ?? '';
    if (withoutPath.startsWith('[')) {
      const bracketEnd = withoutPath.indexOf(']');
      return bracketEnd > 0 ? withoutPath.slice(1, bracketEnd).toLowerCase() : '';
    }

    return withoutPath.toLowerCase().split(':')[0]?.trim() ?? '';
  }

  private extractDefaultSubdomainSlug(hostname: string): string | null {
    const rootDomain = this.getRootDomain();
    if (hostname === rootDomain || !hostname.endsWith(`.${rootDomain}`)) {
      return null;
    }

    const slug = hostname
      .slice(0, -(rootDomain.length + 1))
      .split('.')[0]
      ?.trim();
    if (!slug || isReservedStoreSubdomain(slug) || !isValidStoreSlug(slug)) {
      throw new NotFoundException('Store not found for current host');
    }

    return normalizeStoreSlug(slug);
  }

  private isRootDomainHost(hostname: string): boolean {
    const rootDomain = this.getRootDomain();
    return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
  }

  private allowsExplicitSlug(hostname: string): boolean {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    const previewHost = this.configService.get<string>(
      'STOREFRONT_PREVIEW_HOST',
      'stores.your-domain.com',
    );
    if (hostname === this.normalizeHostname(previewHost)) {
      return true;
    }

    const apiHost = this.configService.get<string>('PUBLIC_API_HOST', 'api.your-domain.com');
    if (hostname === this.normalizeHostname(apiHost)) {
      return true;
    }

    return (
      this.configService.get<string>('NODE_ENV') !== 'production' &&
      !this.isRootDomainHost(hostname)
    );
  }

  private getRootDomain(): string {
    const configured =
      this.configService.get<string>('STOREFRONT_ROOT_DOMAIN') ??
      this.configService.get<string>('APP_BASE_DOMAIN') ??
      'your-domain.com';
    return this.normalizeHostname(configured);
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

  private cacheKeyForHost(host: string): string {
    return `store:host:${host}`;
  }

  private cacheKeyForSlug(slug: string): string {
    return `store:slug:${slug}`;
  }

  private assertStoreIsActive(store: StorePublicRecord): void {
    if (store.status === 'deleted') {
      throw new NotFoundException('Store not found for current host');
    }
    if (store.is_suspended) {
      throw new ForbiddenException('Store is suspended');
    }
  }
}
