import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_CUSTOMER_PUBLIC_KEY } from '../decorators/customer-public.decorator';
import type {
  CustomerAccessTokenPayload,
  CustomerUser,
} from '../interfaces/customer-user.interface';

interface CustomerRequest extends Request {
  customer?: CustomerUser;
  storeId?: string;
}

@Injectable()
export class CustomerAccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<CustomerRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('رمز الوصول مطلوب');
    }

    const payload = await this.verifyToken(token);
    request.customer = this.mapPayloadToCustomer(payload);
    request.storeId = payload.storeId;
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private extractBearerToken(request: CustomerRequest): string | null {
    const authHeader = request.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7).trim();
  }

  private async verifyToken(token: string): Promise<CustomerAccessTokenPayload> {
    try {
      const secret = this.configService.getOrThrow<string>('JWT_CUSTOMER_ACCESS_SECRET');
      return await this.jwtService.verifyAsync<CustomerAccessTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('رمز الوصول غير صالح أو منتهي الصلاحية');
    }
  }

  private mapPayloadToCustomer(payload: CustomerAccessTokenPayload): CustomerUser {
    return {
      id: payload.sub,
      storeId: payload.storeId,
      phone: payload.phone,
      email: payload.email,
      fullName: payload.fullName,
      sessionId: payload.sid,
    };
  }
}
