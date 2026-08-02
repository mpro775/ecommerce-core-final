import { HttpException, HttpStatus } from '@nestjs/common';

export class CommercialDomainException extends HttpException {
  constructor(code: string, message: string, status = HttpStatus.CONFLICT) {
    super({ code, message }, status);
  }
}

export function requireCommercialPermission(
  permissions: string[],
  permission: string,
): void {
  if (permissions.includes('*') || permissions.includes(permission)) return;
  throw new CommercialDomainException(
    'COMMERCIAL_PERMISSION_DENIED',
    `Permission ${permission} is required`,
    HttpStatus.FORBIDDEN,
  );
}

export function requireReason(reason: string | undefined): string {
  const normalized = reason?.trim();
  if (normalized) return normalized;
  throw new CommercialDomainException(
    'COMMERCIAL_OVERRIDE_REASON_REQUIRED',
    'A non-empty reason is required',
    HttpStatus.BAD_REQUEST,
  );
}

