import { Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

@Injectable()
export class BruteForceGuard implements CanActivate {
  private readonly logger = new Logger(BruteForceGuard.name);
  private readonly attempts: Map<string, LoginAttempt> = new Map();

  private readonly maxAttempts: number;
  private readonly lockoutDurationMs: number;
  private readonly windowMs: number;

  constructor(private readonly configService: ConfigService) {
    this.maxAttempts = this.configService.get<number>('AUTH_MAX_ATTEMPTS', 5);
    this.lockoutDurationMs = this.configService.get<number>(
      'AUTH_LOCKOUT_DURATION_MS',
      15 * 60 * 1000,
    );
    this.windowMs = this.configService.get<number>('AUTH_WINDOW_MS', 15 * 60 * 1000);

    setInterval(() => this.cleanup(), 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.getKey(request);

    if (!key) {
      return true;
    }

    const attempt = this.attempts.get(key);

    if (!attempt) {
      return true;
    }

    if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
      const remainingMs = attempt.lockedUntil - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60_000);
      this.logger.warn(`Account locked for ${key}. Remaining: ${remainingMinutes} minutes`);
      return false;
    }

    if (attempt.lockedUntil && Date.now() >= attempt.lockedUntil) {
      this.attempts.delete(key);
    }

    return true;
  }

  recordFailedAttempt(identifier: string, ip: string): void {
    const key = `login:${identifier}:${ip}`;
    const now = Date.now();

    let attempt = this.attempts.get(key);

    if (!attempt || now - attempt.firstAttempt > this.windowMs) {
      attempt = {
        count: 1,
        firstAttempt: now,
      };
    } else {
      attempt.count++;
    }

    if (attempt.count >= this.maxAttempts) {
      attempt.lockedUntil = now + this.lockoutDurationMs;
      this.logger.warn(
        `Account locked for ${identifier} from IP ${ip} after ${attempt.count} attempts`,
      );
    }

    this.attempts.set(key, attempt);
  }

  recordSuccessfulAttempt(identifier: string, ip: string): void {
    const key = `login:${identifier}:${ip}`;
    this.attempts.delete(key);
  }

  getRemainingAttempts(identifier: string, ip: string): number {
    const key = `login:${identifier}:${ip}`;
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.lockedUntil) {
      return this.maxAttempts;
    }

    return Math.max(0, this.maxAttempts - attempt.count);
  }

  isLocked(identifier: string, ip: string): { locked: boolean; remainingMs?: number } {
    const key = `login:${identifier}:${ip}`;
    const attempt = this.attempts.get(key);

    if (!attempt || !attempt.lockedUntil) {
      return { locked: false };
    }

    const remainingMs = attempt.lockedUntil - Date.now();
    if (remainingMs <= 0) {
      return { locked: false };
    }

    return { locked: true, remainingMs };
  }

  private getKey(request: Request): string | null {
    const ip = this.extractIp(request);
    const body = request.body as { email?: string; identifier?: string } | undefined;
    const identifier = body?.email || body?.identifier;

    if (!ip || !identifier) {
      return null;
    }

    return `login:${identifier}:${ip}`;
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const parts = forwarded.split(',');
      return (parts[0] || '').trim();
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, attempt] of this.attempts) {
      const expiryTime = attempt.lockedUntil || attempt.firstAttempt + this.windowMs;
      if (now > expiryTime) {
        this.attempts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired login attempts`);
    }
  }
}
