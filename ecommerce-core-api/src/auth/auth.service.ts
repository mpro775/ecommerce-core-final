import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type { AuthResult } from './interfaces/auth-result.interface';
import type { AuthUser, StoreRole } from './interfaces/auth-user.interface';
import { buildRefreshToken, parseRefreshToken } from './utils/refresh-token.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto, context: RequestContextData): Promise<AuthResult> {
    const user = await this.authRepository.findUserByEmail(input.email.trim().toLowerCase());
    const valid = user && (await argon2.verify(user.password_hash, input.password));

    if (!user || !valid || !user.is_active || user.store_is_suspended) {
      await this.logAuthEvent(
        'auth.login_failed',
        user?.store_id ?? null,
        user?.id ?? null,
        context,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.touchUserLastLogin(user.id);
    const authUser = this.mapUserRecordToAuthUser(user, '');
    const result = await this.issueSessionTokens(authUser, context);
    await this.logAuthEvent('auth.login_succeeded', user.store_id, user.id, context);
    return result;
  }

  async refresh(input: RefreshTokenDto, context: RequestContextData): Promise<AuthResult> {
    const parsed = parseRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const session = await this.authRepository.findSessionById(parsed.sessionId);
    this.assertSessionUsable(session);
    const validSecret = await argon2.verify(session.refresh_token_hash, parsed.secret);
    if (!validSecret) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.requireUserById(session.store_user_id);
    const result = await this.issueSessionTokens(user, context, session.id);
    await this.logAuthEvent('auth.refresh_succeeded', user.storeId, user.id, context);
    return result;
  }

  async logout(currentUser: AuthUser, context: RequestContextData): Promise<void> {
    await this.authRepository.revokeSession(currentUser.sessionId);
    await this.logAuthEvent('auth.logout', currentUser.storeId, currentUser.id, context);
  }

  async me(currentUser: AuthUser): Promise<AuthUser> {
    const user = await this.requireUserById(currentUser.id);
    return {
      ...user,
      sessionId: currentUser.sessionId,
    };
  }

  private async issueSessionTokens(
    user: AuthUser,
    context: RequestContextData,
    fixedSessionId?: string,
  ): Promise<AuthResult> {
    const expiresAt = this.getRefreshExpiryDate();
    const sessionId = fixedSessionId ?? uuidv4();
    const refresh = buildRefreshToken(sessionId);
    const refreshTokenHash = await this.hashValue(refresh.secret);

    if (fixedSessionId) {
      await this.authRepository.rotateSession({
        sessionId,
        refreshTokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } else {
      await this.authRepository.createSession({
        sessionId,
        userId: user.id,
        storeId: user.storeId,
        refreshTokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    const accessToken = await this.signAccessToken(user, sessionId);
    return { accessToken, refreshToken: refresh.token, user: { ...user, sessionId } };
  }

  private assertSessionUsable(
    session: {
      id: string;
      store_user_id: string;
      refresh_token_hash: string;
      expires_at: Date;
      revoked_at: Date | null;
    } | null,
  ): asserts session is {
    id: string;
    store_user_id: string;
    refresh_token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
  } {
    if (!session) {
      throw new UnauthorizedException('Refresh session not found');
    }

    if (session.revoked_at) {
      throw new UnauthorizedException('Refresh session revoked');
    }

    if (session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh session expired');
    }
  }

  private async signAccessToken(user: AuthUser, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      sid: sessionId,
      storeId: user.storeId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    };

    return this.jwtService.signAsync(payload);
  }

  private mapUserRecordToAuthUser(
    user: {
      id: string;
      store_id: string;
      email: string;
      full_name: string;
      role: StoreRole;
      permissions: string[];
      store_onboarding_completed_at: Date | null;
    },
    sessionId: string,
  ): AuthUser {
    return {
      id: user.id,
      storeId: user.store_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      permissions: user.permissions,
      sessionId,
      onboardingCompleted: Boolean(user.store_onboarding_completed_at),
    };
  }

  private async requireUserById(userId: string): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user || !user.is_active || user.store_is_suspended) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return this.mapUserRecordToAuthUser(user, '');
  }

  private async hashValue(value: string): Promise<string> {
    return argon2.hash(value, { type: argon2.argon2id });
  }

  private getRefreshExpiryDate(): Date {
    const ttlDays = this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const millis = ttlDays * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + millis);
  }

  private async logAuthEvent(
    action: string,
    storeId: string | null,
    storeUserId: string | null,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId,
      storeUserId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }
}
