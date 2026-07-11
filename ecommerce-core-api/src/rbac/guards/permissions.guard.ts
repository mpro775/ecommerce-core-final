import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const hasPermission =
      user.role === 'owner' || this.hasAllPermissions(user.permissions, required);
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private hasAllPermissions(granted: string[], required: string[]): boolean {
    if (granted.includes('*')) {
      return true;
    }
    return required.every((permission) => this.hasPermission(granted, permission));
  }

  private hasPermission(granted: string[], required: string): boolean {
    if (granted.includes(required)) {
      return true;
    }

    if (required.endsWith(':read')) {
      return granted.includes('store:read') || granted.includes('store:write');
    }

    if (required.endsWith(':write') || required.endsWith(':export')) {
      return granted.includes('store:write');
    }

    return false;
  }
}
