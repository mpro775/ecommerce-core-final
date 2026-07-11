import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CustomerUser } from '../interfaces/customer-user.interface';

export const CurrentCustomer = createParamDecorator(
  (_: unknown, context: ExecutionContext): CustomerUser | null => {
    const request = context.switchToHttp().getRequest<{ customer?: CustomerUser }>();
    return request.customer ?? null;
  },
);
