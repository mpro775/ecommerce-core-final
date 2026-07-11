import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';

export function hashTokenDeterministic(token: string, secret: string): string {
  if (!secret) {
    throw new Error('TOKEN_HASH_SECRET is required to hash sensitive tokens');
  }

  return createHmac('sha256', secret).update(token.trim(), 'utf8').digest('hex');
}

export function getTokenHashSecret(configService: ConfigService): string {
  return configService.getOrThrow<string>('TOKEN_HASH_SECRET');
}
