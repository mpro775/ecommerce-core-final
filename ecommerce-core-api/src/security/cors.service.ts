import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class CorsService {
  constructor(private readonly configService: ConfigService) {}

  async isOriginAllowed(origin: string | undefined, request?: Request): Promise<boolean> {
    void request;
    if (!origin) {
      return true;
    }

    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;

      const allowedStaticOrigins = this.getStaticAllowedOrigins();
      if (allowedStaticOrigins.some((o) => o === origin || o.includes(hostname))) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async getStoreIdForOrigin(origin: string): Promise<string | null> {
    void origin;
    return null;
  }

  async getAllowedOrigins(): Promise<string[]> {
    return [...new Set(this.getStaticAllowedOrigins())];
  }

  invalidateCache(hostname?: string): void {
    void hostname;
  }

  private getStaticAllowedOrigins(): string[] {
    const allowedOrigins = this.configService.get<string>('ALLOWED_ORIGINS', '');
    if (!allowedOrigins) {
      return ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];
    }
    return allowedOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

}
