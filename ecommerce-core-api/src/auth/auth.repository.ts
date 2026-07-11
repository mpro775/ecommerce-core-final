import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { StoreRole } from './interfaces/auth-user.interface';

export interface UserRecord {
  id: string;
  store_id: string;
  email: string;
  full_name: string;
  role: StoreRole;
  permissions: string[];
  password_hash: string;
  is_active: boolean;
  store_is_suspended: boolean;
  store_onboarding_completed_at: Date | null;
}

export interface SessionRecord {
  id: string;
  store_user_id: string;
  store_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface RegisterOwnerInput {
  storeId: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  storePhone?: string | null;
  fullName: string;
  email: string;
  passwordHash: string;
  ownerPhone?: string | null;
  permissions: string[];
}

export interface OwnerRegistrationChallengeRecord {
  id: string;
  full_name: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  owner_phone: string;
  store_name: string;
  store_slug: string;
  store_phone: string | null;
  otp_hash: string;
  otp_expires_at: Date;
  verify_attempts: number;
  resend_count: number;
  last_sent_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.databaseService.db.query<UserRecord>(
      `
        SELECT id, store_id, email, full_name, role, permissions, password_hash, is_active
               , (SELECT is_suspended OR COALESCE(status, 'active') = 'deleted' FROM stores WHERE id = store_users.store_id) AS store_is_suspended
               , (SELECT onboarding_completed_at FROM stores WHERE id = store_users.store_id) AS store_onboarding_completed_at
        FROM store_users
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const result = await this.databaseService.db.query<UserRecord>(
      `
        SELECT id, store_id, email, full_name, role, permissions, password_hash, is_active
               , (SELECT is_suspended OR COALESCE(status, 'active') = 'deleted' FROM stores WHERE id = store_users.store_id) AS store_is_suspended
               , (SELECT onboarding_completed_at FROM stores WHERE id = store_users.store_id) AS store_onboarding_completed_at
        FROM store_users
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async storeSlugExists(storeSlug: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS(SELECT 1 FROM stores WHERE slug = $1) AS exists
      `,
      [storeSlug],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async createStoreWithOwner(input: RegisterOwnerInput): Promise<void> {
    const client = await this.databaseService.db.connect();

    try {
      await client.query('BEGIN');
      await this.insertStore(client, input);
      await this.insertStoreUser(client, input);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePendingOwnerRegistrationChallengesByEmail(emailNormalized: string): Promise<void> {
    await this.databaseService.db.query(
      `
        DELETE FROM owner_registration_challenges
        WHERE consumed_at IS NULL
          AND email_normalized = $1
      `,
      [emailNormalized],
    );
  }

  async createOwnerRegistrationChallenge(input: {
    challengeId: string;
    fullName: string;
    email: string;
    emailNormalized: string;
    passwordHash: string;
    ownerPhone: string;
    storeName: string;
    storeSlug: string;
    storePhone: string | null;
    otpHash: string;
    otpExpiresAt: Date;
    lastSentAt: Date;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO owner_registration_challenges (
          id,
          full_name,
          email,
          email_normalized,
          password_hash,
          owner_phone,
          store_name,
          store_slug,
          store_phone,
          otp_hash,
          otp_expires_at,
          verify_attempts,
          resend_count,
          last_sent_at,
          consumed_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, $12, NULL, NOW(), NOW())
      `,
      [
        input.challengeId,
        input.fullName,
        input.email,
        input.emailNormalized,
        input.passwordHash,
        input.ownerPhone,
        input.storeName,
        input.storeSlug,
        input.storePhone,
        input.otpHash,
        input.otpExpiresAt,
        input.lastSentAt,
      ],
    );
  }

  async findOwnerRegistrationChallengeById(
    challengeId: string,
  ): Promise<OwnerRegistrationChallengeRecord | null> {
    const result = await this.databaseService.db.query<OwnerRegistrationChallengeRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          email_normalized,
          password_hash,
          owner_phone,
          store_name,
          store_slug,
          store_phone,
          otp_hash,
          otp_expires_at,
          verify_attempts,
          resend_count,
          last_sent_at,
          consumed_at,
          created_at,
          updated_at
        FROM owner_registration_challenges
        WHERE id = $1
        LIMIT 1
      `,
      [challengeId],
    );

    return result.rows[0] ?? null;
  }

  async incrementOwnerRegistrationVerifyAttempts(challengeId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE owner_registration_challenges
        SET verify_attempts = verify_attempts + 1,
            updated_at = NOW()
        WHERE id = $1
      `,
      [challengeId],
    );
  }

  async updateOwnerRegistrationChallengeOtp(input: {
    challengeId: string;
    otpHash: string;
    otpExpiresAt: Date;
    lastSentAt: Date;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE owner_registration_challenges
        SET otp_hash = $2,
            otp_expires_at = $3,
            resend_count = resend_count + 1,
            last_sent_at = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.challengeId, input.otpHash, input.otpExpiresAt, input.lastSentAt],
    );
  }

  async markOwnerRegistrationChallengeConsumed(challengeId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE owner_registration_challenges
        SET consumed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [challengeId],
    );
  }

  async createSession(input: {
    sessionId?: string;
    userId: string;
    storeId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<string> {
    const sessionId = input.sessionId ?? uuidv4();
    await this.databaseService.db.query(
      `
        INSERT INTO sessions (
          id,
          store_user_id,
          store_id,
          refresh_token_hash,
          expires_at,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        sessionId,
        input.userId,
        input.storeId,
        input.refreshTokenHash,
        input.expiresAt,
        input.ipAddress,
        input.userAgent,
      ],
    );
    return sessionId;
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.databaseService.db.query<SessionRecord>(
      `
        SELECT id, store_user_id, store_id, refresh_token_hash, expires_at, revoked_at
        FROM sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );
    return result.rows[0] ?? null;
  }

  async rotateSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE sessions
        SET refresh_token_hash = $2,
            expires_at = $3,
            rotation_counter = rotation_counter + 1,
            last_seen_at = NOW(),
            ip_address = $4,
            user_agent = $5,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.sessionId, input.refreshTokenHash, input.expiresAt, input.ipAddress, input.userAgent],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE sessions
        SET revoked_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await this.databaseService.db.query(
      `
        UPDATE sessions
        SET revoked_at = NOW(),
            updated_at = NOW()
        WHERE store_user_id = $1
          AND revoked_at IS NULL
      `,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  async touchUserLastLogin(userId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE store_users
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId],
    );
  }

  private async insertStore(
    client: { query: (query: string, values?: unknown[]) => Promise<unknown> },
    input: RegisterOwnerInput,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO stores (id, name, slug)
        VALUES ($1, $2, $3)
      `,
      [input.storeId, input.storeName, input.storeSlug],
    );

    if (input.storePhone) {
      await client.query(
        `
          UPDATE stores
          SET phone = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [input.storeId, input.storePhone],
      );
    }
  }

  private async insertStoreUser(
    client: { query: (query: string, values?: unknown[]) => Promise<unknown> },
    input: RegisterOwnerInput,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO store_users (
          id,
          store_id,
          email,
          password_hash,
          phone,
          full_name,
          role,
          permissions
        ) VALUES ($1, $2, $3, $4, $5, $6, 'owner', $7::jsonb)
      `,
      [
        input.userId,
        input.storeId,
        input.email,
        input.passwordHash,
        input.ownerPhone ?? null,
        input.fullName,
        JSON.stringify(input.permissions),
      ],
    );
  }
}
