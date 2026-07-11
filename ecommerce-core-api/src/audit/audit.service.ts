import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface AuditLogInput {
  storeId: string | null;
  storeUserId: string | null;
  platformAdminId?: string | null;
  customerId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  category?: string | null;
  severity?: 'debug' | 'info' | 'warning' | 'critical';
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  async log(input: AuditLogInput, db?: Queryable): Promise<void> {
    const queryable = db ?? this.databaseService.db;
    await queryable.query(
      `
        INSERT INTO audit_logs (
          id,
          actor_type,
          actor_id,
          store_id,
          store_user_id,
          platform_admin_id,
          customer_id,
          action,
          category,
          severity,
          target_type,
          target_id,
          before_snapshot,
          after_snapshot,
          ip_address,
          user_agent,
          request_id,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        uuidv4(),
        this.resolveActorType(input),
        this.resolveActorId(input),
        input.storeId,
        input.storeUserId,
        input.platformAdminId ?? null,
        input.customerId ?? null,
        input.action,
        input.category ?? null,
        input.severity ?? 'info',
        input.targetType ?? null,
        input.targetId ?? null,
        input.beforeSnapshot ?? null,
        input.afterSnapshot ?? null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        this.resolveRequestId(input.metadata),
        input.metadata ?? {},
      ],
    );
  }

  private resolveActorType(input: AuditLogInput): string {
    if (input.platformAdminId) {
      return 'platform_admin';
    }
    if (input.storeUserId) {
      return 'store_user';
    }
    if (input.customerId) {
      return 'customer';
    }
    return 'system';
  }

  private resolveActorId(input: AuditLogInput): string | null {
    return input.platformAdminId ?? input.storeUserId ?? input.customerId ?? null;
  }

  private resolveRequestId(metadata: Record<string, unknown> | undefined): string | null {
    const requestId = metadata?.requestId;
    return typeof requestId === 'string' && requestId.length > 0 ? requestId : null;
  }
}
