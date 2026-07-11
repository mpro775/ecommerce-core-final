import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenPayload } from '../interfaces/access-token-payload.interface';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    const payload = await this.verifyToken(token);
    request.user = this.mapPayloadToUser(payload);
    request.storeId = payload.storeId;
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const authHeader = request.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7).trim();
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    try {
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private mapPayloadToUser(payload: AccessTokenPayload) {
    return {
      id: payload.sub,
      storeId: payload.storeId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      permissions: payload.permissions,
      sessionId: payload.sid,
      onboardingCompleted: false,
    };
  }
}
