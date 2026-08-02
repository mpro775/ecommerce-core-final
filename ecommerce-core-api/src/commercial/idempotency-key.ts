import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export function requireIdempotencyKey(request: Request): string {
  const raw = request.headers['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const key = value?.trim();
  if (!key || key.length < 16 || key.length > 200) {
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key must contain between 16 and 200 characters',
    });
  }
  return key;
}
