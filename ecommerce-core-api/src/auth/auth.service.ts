import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import { OWNER_PERMISSIONS } from './constants/permission.constants';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterOwnerDto } from './dto/register-owner.dto';
import type { RegisterOwnerStartDto } from './dto/register-owner-start.dto';
import type { VerifyOwnerRegistrationOtpDto } from './dto/verify-owner-registration-otp.dto';
import type { ResendOwnerRegistrationOtpDto } from './dto/resend-owner-registration-otp.dto';
import { AuthRepository, type OwnerRegistrationChallengeRecord } from './auth.repository';
import type { AuthResult } from './interfaces/auth-result.interface';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type { AuthUser, StoreRole } from './interfaces/auth-user.interface';
import { buildRefreshToken, parseRefreshToken } from './utils/refresh-token.util';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import { EmailService } from '../email/email.service';
import type { OwnerRegistrationChallengeResult } from './interfaces/owner-registration-challenge-result.interface';
import { isValidStoreSlug, normalizeStoreSlug } from '../stores/constants/store-slug.constants';

const DEFAULT_STORE_NAME = 'New Store';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
    private readonly emailService: EmailService,
  ) {}

  async registerOwner(_input: RegisterOwnerDto, _context: RequestContextData): Promise<AuthResult> {
    throw new BadRequestException(
      'تم إيقاف التسجيل المباشر. استخدم /auth/register-owner/start ثم /auth/register-owner/verify',
    );
  }

  async startOwnerRegistration(
    input: RegisterOwnerStartDto,
    context: RequestContextData,
  ): Promise<OwnerRegistrationChallengeResult> {
    const normalized = await this.normalizeOwnerRegistrationInput(input);
    await this.ensureEmailAvailability(normalized.email);

    const challengeId = uuidv4();
    const now = new Date();
    const otpCode = this.generateOtpCode();
    const otpHash = this.hashOtpCode(otpCode);
    const otpExpiresAt = this.getOtpExpiryDate(now);

    await this.authRepository.deletePendingOwnerRegistrationChallengesByEmail(normalized.email);

    await this.authRepository.createOwnerRegistrationChallenge({
      challengeId,
      fullName: normalized.fullName,
      email: normalized.email,
      emailNormalized: normalized.email,
      passwordHash: normalized.passwordHash,
      ownerPhone: normalized.ownerPhone,
      storeName: DEFAULT_STORE_NAME,
      storeSlug: `pending-${challengeId.slice(0, 8)}`,
      storePhone: null,
      otpHash,
      otpExpiresAt,
      lastSentAt: now,
    });

    await this.emailService.sendOwnerRegistrationOtp({
      to: normalized.email,
      fullName: normalized.fullName,
      otpCode,
      expiresInMinutes: this.getOtpTtlMinutes(),
      storeName: DEFAULT_STORE_NAME,
    });

    await this.logAuthEvent('auth.register_owner_otp_sent', null, null, context);
    return this.toChallengeResult(challengeId, otpExpiresAt, now);
  }

  async verifyOwnerRegistrationOtp(
    input: VerifyOwnerRegistrationOtpDto,
    context: RequestContextData,
  ): Promise<AuthResult> {
    const challenge = await this.requireActiveOwnerRegistrationChallenge(input.challengeId);
    this.ensureOtpAttemptsRemaining(challenge);

    if (!this.verifyOtpCode(challenge.otp_hash, input.otpCode.trim())) {
      await this.authRepository.incrementOwnerRegistrationVerifyAttempts(challenge.id);
      await this.logAuthEvent('auth.register_owner_otp_failed', null, null, context);
      throw new UnauthorizedException('رمز التحقق غير صحيح');
    }

    await this.ensureEmailAvailability(challenge.email_normalized);

    const storeId = uuidv4();
    const userId = uuidv4();
    const generatedStoreSlug = await this.generateDefaultStoreSlug();

    await this.authRepository.createStoreWithOwner({
      storeId,
      userId,
      storeName: DEFAULT_STORE_NAME,
      storeSlug: generatedStoreSlug,
      storePhone: null,
      fullName: challenge.full_name,
      email: challenge.email_normalized,
      passwordHash: challenge.password_hash,
      ownerPhone: challenge.owner_phone,
      permissions: OWNER_PERMISSIONS,
    });

    await this.authRepository.markOwnerRegistrationChallengeConsumed(challenge.id);

    const user = await this.requireUserById(userId);
    const authResult = await this.issueSessionTokens(user, context);
    await this.logAuthEvent('auth.register_owner_verified', user.storeId, user.id, context);
    return authResult;
  }

  async resendOwnerRegistrationOtp(
    input: ResendOwnerRegistrationOtpDto,
    context: RequestContextData,
  ): Promise<OwnerRegistrationChallengeResult> {
    const challenge = await this.requireActiveOwnerRegistrationChallenge(input.challengeId);
    this.ensureOtpResendAllowed(challenge);

    const now = new Date();
    const otpCode = this.generateOtpCode();
    const otpHash = this.hashOtpCode(otpCode);
    const otpExpiresAt = this.getOtpExpiryDate(now);

    await this.authRepository.updateOwnerRegistrationChallengeOtp({
      challengeId: challenge.id,
      otpHash,
      otpExpiresAt,
      lastSentAt: now,
    });

    await this.emailService.sendOwnerRegistrationOtp({
      to: challenge.email,
      fullName: challenge.full_name,
      otpCode,
      expiresInMinutes: this.getOtpTtlMinutes(),
      storeName: DEFAULT_STORE_NAME,
    });

    await this.logAuthEvent('auth.register_owner_otp_resent', null, null, context);
    return this.toChallengeResult(challenge.id, otpExpiresAt, now);
  }

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

  private async ensureEmailAvailability(email: string): Promise<void> {
    const emailUser = await this.authRepository.findUserByEmail(email.trim().toLowerCase());
    if (emailUser) {
      throw new ConflictException('������ ���������� ������ ������');
    }
  }

  private async generateDefaultStoreSlug(): Promise<string> {
    const maxAttempts = 10;
    for (let index = 0; index < maxAttempts; index += 1) {
      const candidate = normalizeStoreSlug(`store-${Math.random().toString(36).slice(2, 8)}`);
      if (!isValidStoreSlug(candidate)) {
        continue;
      }

      const slugExists = await this.authRepository.storeSlugExists(candidate);
      if (!slugExists) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate unique store slug');
  }

  private async normalizeOwnerRegistrationInput(input: RegisterOwnerStartDto): Promise<{
    fullName: string;
    email: string;
    passwordHash: string;
    ownerPhone: string;
  }> {
    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.hashValue(input.password);
    const ownerPhone = input.ownerPhone.trim();

    return {
      fullName,
      email,
      passwordHash,
      ownerPhone,
    };
  }

  private async requireActiveOwnerRegistrationChallenge(
    challengeId: string,
  ): Promise<OwnerRegistrationChallengeRecord> {
    const challenge = await this.authRepository.findOwnerRegistrationChallengeById(challengeId);
    if (!challenge) {
      throw new UnauthorizedException('جلسة التحقق غير موجودة');
    }

    if (challenge.consumed_at) {
      throw new BadRequestException('تم استخدام جلسة التحقق مسبقاً، ابدأ التسجيل من جديد');
    }

    if (challenge.otp_expires_at.getTime() <= Date.now()) {
      throw new BadRequestException(
        'انتهت صلاحية رمز التحقق، أعد إرسال رمز جديد أو ابدأ التسجيل من جديد',
      );
    }

    return challenge;
  }

  private ensureOtpAttemptsRemaining(challenge: OwnerRegistrationChallengeRecord): void {
    const maxAttempts = this.configService.get<number>('AUTH_OTP_MAX_VERIFY_ATTEMPTS', 5);
    if (challenge.verify_attempts >= maxAttempts) {
      throw new BadRequestException('تم تجاوز الحد الأقصى لمحاولات التحقق، ابدأ التسجيل من جديد');
    }
  }

  private ensureOtpResendAllowed(challenge: OwnerRegistrationChallengeRecord): void {
    const maxResendCount = this.configService.get<number>('AUTH_OTP_MAX_RESEND_COUNT', 5);
    if (challenge.resend_count >= maxResendCount) {
      throw new BadRequestException(
        'تم تجاوز الحد الأقصى لإعادة إرسال الرمز، ابدأ التسجيل من جديد',
      );
    }

    const resendCooldownSeconds = this.configService.get<number>(
      'AUTH_OTP_RESEND_COOLDOWN_SECONDS',
      60,
    );
    const nextAllowedAt = challenge.last_sent_at.getTime() + resendCooldownSeconds * 1000;
    if (nextAllowedAt > Date.now()) {
      throw new BadRequestException('يرجى الانتظار قليلاً قبل طلب رمز جديد');
    }
  }

  private verifyOtpCode(storedHash: string, code: string): boolean {
    const expected = Buffer.from(storedHash, 'utf8');
    const actual = Buffer.from(this.hashOtpCode(code), 'utf8');

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }

  private hashOtpCode(code: string): string {
    const secret = this.configService.get<string>('AUTH_OTP_SECRET');
    if (!secret) {
      throw new Error('AUTH_OTP_SECRET is not configured');
    }

    return createHmac('sha256', secret).update(code).digest('hex');
  }

  private generateOtpCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private getOtpTtlMinutes(): number {
    return this.configService.get<number>('AUTH_OTP_TTL_MINUTES', 10);
  }

  private getOtpExpiryDate(now: Date): Date {
    return new Date(now.getTime() + this.getOtpTtlMinutes() * 60_000);
  }

  private toChallengeResult(
    challengeId: string,
    expiresAt: Date,
    issuedAt: Date,
  ): OwnerRegistrationChallengeResult {
    const resendCooldownSeconds = this.configService.get<number>(
      'AUTH_OTP_RESEND_COOLDOWN_SECONDS',
      60,
    );
    const resendAvailableAt = new Date(issuedAt.getTime() + resendCooldownSeconds * 1000);

    return {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
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
