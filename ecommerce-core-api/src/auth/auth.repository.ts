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

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.databaseService.db.query<UserRecord>(
      `
        SELECT id, store_id, email, full_name, role, permissions, password_hash, is_active,
               (SELECT is_suspended FROM stores WHERE id = store_users.store_id) AS store_is_suspended,
               (SELECT onboarding_completed_at FROM stores WHERE id = store_users.store_id) AS store_onboarding_completed_at
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
        SELECT id, store_id, email, full_name, role, permissions, password_hash, is_active,
               (SELECT is_suspended FROM stores WHERE id = store_users.store_id) AS store_is_suspended,
               (SELECT onboarding_completed_at FROM stores WHERE id = store_users.store_id) AS store_onboarding_completed_at
        FROM store_users
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId],
    );
    return result.rows[0] ?? null;
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
}
