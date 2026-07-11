import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../interfaces/auth-user.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser | null => {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user ?? null;
  },
);
