import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type {
  SupportAssigneeType,
  SupportMessageAuthorType,
  SupportRequesterType,
  SupportTicketPriority,
  SupportTicketScope,
  SupportTicketSource,
  SupportTicketStatus,
} from './constants/support.constants';

export interface SupportTicketRecord {
  id: string;
  store_id: string;
  scope: SupportTicketScope;
  source: SupportTicketSource;
  subject: string;
  description: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requester_type: SupportRequesterType;
  requester_customer_id: string | null;
  requester_store_user_id: string | null;
  requester_label: string | null;
  requester_customer_name: string | null;
  requester_store_user_name: string | null;
  assigned_to_type: SupportAssigneeType | null;
  assigned_to_store_user_id: string | null;
  assigned_to_label: string | null;
  assigned_store_user_name: string | null;
  sla_first_response_due_at: Date | null;
  sla_resolve_due_at: Date | null;
  first_response_at: Date | null;
  resolved_at: Date | null;
  closed_at: Date | null;
  last_message_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SupportMessageRecord {
  id: string;
  ticket_id: string;
  store_id: string;
  author_type: SupportMessageAuthorType;
  author_customer_id: string | null;
  author_store_user_id: string | null;
  author_label: string | null;
  author_customer_name: string | null;
  author_store_user_name: string | null;
  message: string;
  is_internal: boolean;
  attachments: unknown[];
  created_at: Date;
  updated_at: Date;
}

export interface SupportTicketEventRecord {
  id: string;
  ticket_id: string;
  store_id: string;
  event_type: string;
  actor_type: SupportMessageAuthorType;
  actor_customer_id: string | null;
  actor_store_user_id: string | null;
  actor_label: string | null;
  actor_customer_name: string | null;
  actor_store_user_name: string | null;
  payload: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class SupportRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTicket(input: {
    storeId: string;
    scope: SupportTicketScope;
    source: SupportTicketSource;
    subject: string;
    description: string | null;
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    requesterType: SupportRequesterType;
    requesterCustomerId: string | null;
    requesterStoreUserId: string | null;
    requesterLabel: string | null;
    assignedToType: SupportAssigneeType | null;
    assignedToStoreUserId: string | null;
    assignedToLabel: string | null;
    slaFirstResponseDueAt: Date | null;
    slaResolveDueAt: Date | null;
    metadata: Record<string, unknown>;
  }): Promise<SupportTicketRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<SupportTicketRecord>(
      `
        INSERT INTO support_tickets (
          id,
          store_id,
          scope,
          source,
          subject,
          description,
          status,
          priority,
          requester_type,
          requester_customer_id,
          requester_store_user_id,
          requester_label,
          assigned_to_type,
          assigned_to_store_user_id,
          assigned_to_label,
          sla_first_response_due_at,
          sla_resolve_due_at,
          metadata,
          last_message_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18::jsonb, NOW()
        )
        RETURNING
          id,
          store_id,
          scope,
          source,
          subject,
          description,
          status,
          priority,
          requester_type,
          requester_customer_id,
          requester_store_user_id,
          requester_label,
          NULL::text AS requester_customer_name,
          NULL::text AS requester_store_user_name,
          assigned_to_type,
          assigned_to_store_user_id,
          assigned_to_label,
          NULL::text AS assigned_store_user_name,
          sla_first_response_due_at,
          sla_resolve_due_at,
          first_response_at,
          resolved_at,
          closed_at,
          last_message_at,
          metadata,
          created_at,
          updated_at
      `,
      [
        id,
        input.storeId,
        input.scope,
        input.source,
        input.subject,
        input.description,
        input.status,
        input.priority,
        input.requesterType,
        input.requesterCustomerId,
        input.requesterStoreUserId,
        input.requesterLabel,
        input.assignedToType,
        input.assignedToStoreUserId,
        input.assignedToLabel,
        input.slaFirstResponseDueAt,
        input.slaResolveDueAt,
        JSON.stringify(input.metadata),
      ],
    );

    return result.rows[0]!;
  }

  async listTickets(input: {
    storeId: string;
    scope?: SupportTicketScope;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    q?: string;
    page: number;
    limit: number;
    requesterCustomerId?: string;
  }): Promise<{ rows: SupportTicketRecord[]; total: number }> {
    const whereParts: string[] = ['t.store_id = $1'];
    const params: Array<string | number> = [input.storeId];
    let paramIndex = 2;

    if (input.scope) {
      whereParts.push(`t.scope = $${paramIndex++}`);
      params.push(input.scope);
    }
    if (input.status) {
      whereParts.push(`t.status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.priority) {
      whereParts.push(`t.priority = $${paramIndex++}`);
      params.push(input.priority);
    }
    if (input.requesterCustomerId) {
      whereParts.push(`t.requester_customer_id = $${paramIndex++}`);
      params.push(input.requesterCustomerId);
    }
    if (input.q?.trim()) {
      whereParts.push(
        `(t.subject ILIKE $${paramIndex} OR COALESCE(t.description, '') ILIKE $${paramIndex})`,
      );
      params.push(`%${input.q.trim()}%`);
      paramIndex += 1;
    }

    const whereClause = whereParts.join(' AND ');
    const limit = input.limit;
    const offset = (input.page - 1) * input.limit;

    const rowsResult = await this.databaseService.db.query<SupportTicketRecord>(
      `
        SELECT
          t.id,
          t.store_id,
          t.scope,
          t.source,
          t.subject,
          t.description,
          t.status,
          t.priority,
          t.requester_type,
          t.requester_customer_id,
          t.requester_store_user_id,
          t.requester_label,
          c.full_name AS requester_customer_name,
          su.full_name AS requester_store_user_name,
          t.assigned_to_type,
          t.assigned_to_store_user_id,
          t.assigned_to_label,
          au.full_name AS assigned_store_user_name,
          t.sla_first_response_due_at,
          t.sla_resolve_due_at,
          t.first_response_at,
          t.resolved_at,
          t.closed_at,
          t.last_message_at,
          t.metadata,
          t.created_at,
          t.updated_at
        FROM support_tickets t
        LEFT JOIN customers c ON c.id = t.requester_customer_id
        LEFT JOIN store_users su ON su.id = t.requester_store_user_id
        LEFT JOIN store_users au ON au.id = t.assigned_to_store_user_id
        WHERE ${whereClause}
        ORDER BY t.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM support_tickets t
        WHERE ${whereClause}
      `,
      params,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async findTicketById(storeId: string, ticketId: string): Promise<SupportTicketRecord | null> {
    const result = await this.databaseService.db.query<SupportTicketRecord>(
      `
        SELECT
          t.id,
          t.store_id,
          t.scope,
          t.source,
          t.subject,
          t.description,
          t.status,
          t.priority,
          t.requester_type,
          t.requester_customer_id,
          t.requester_store_user_id,
          t.requester_label,
          c.full_name AS requester_customer_name,
          su.full_name AS requester_store_user_name,
          t.assigned_to_type,
          t.assigned_to_store_user_id,
          t.assigned_to_label,
          au.full_name AS assigned_store_user_name,
          t.sla_first_response_due_at,
          t.sla_resolve_due_at,
          t.first_response_at,
          t.resolved_at,
          t.closed_at,
          t.last_message_at,
          t.metadata,
          t.created_at,
          t.updated_at
        FROM support_tickets t
        LEFT JOIN customers c ON c.id = t.requester_customer_id
        LEFT JOIN store_users su ON su.id = t.requester_store_user_id
        LEFT JOIN store_users au ON au.id = t.assigned_to_store_user_id
        WHERE t.store_id = $1 AND t.id = $2
        LIMIT 1
      `,
      [storeId, ticketId],
    );
    return result.rows[0] ?? null;
  }

  async insertMessage(input: {
    ticketId: string;
    storeId: string;
    authorType: SupportMessageAuthorType;
    authorCustomerId: string | null;
    authorStoreUserId: string | null;
    authorLabel: string | null;
    message: string;
    isInternal: boolean;
    attachments?: unknown[];
  }): Promise<SupportMessageRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<SupportMessageRecord>(
      `
        INSERT INTO support_messages (
          id,
          ticket_id,
          store_id,
          author_type,
          author_customer_id,
          author_store_user_id,
          author_label,
          message,
          is_internal,
          attachments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        RETURNING
          id,
          ticket_id,
          store_id,
          author_type,
          author_customer_id,
          author_store_user_id,
          author_label,
          NULL::text AS author_customer_name,
          NULL::text AS author_store_user_name,
          message,
          is_internal,
          attachments,
          created_at,
          updated_at
      `,
      [
        id,
        input.ticketId,
        input.storeId,
        input.authorType,
        input.authorCustomerId,
        input.authorStoreUserId,
        input.authorLabel,
        input.message,
        input.isInternal,
        JSON.stringify(input.attachments ?? []),
      ],
    );

    await this.databaseService.db.query(
      `
        UPDATE support_tickets
        SET last_message_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.ticketId],
    );

    return result.rows[0]!;
  }

  async listMessages(ticketId: string): Promise<SupportMessageRecord[]> {
    const result = await this.databaseService.db.query<SupportMessageRecord>(
      `
        SELECT
          m.id,
          m.ticket_id,
          m.store_id,
          m.author_type,
          m.author_customer_id,
          m.author_store_user_id,
          m.author_label,
          c.full_name AS author_customer_name,
          su.full_name AS author_store_user_name,
          m.message,
          m.is_internal,
          m.attachments,
          m.created_at,
          m.updated_at
        FROM support_messages m
        LEFT JOIN customers c ON c.id = m.author_customer_id
        LEFT JOIN store_users su ON su.id = m.author_store_user_id
        WHERE m.ticket_id = $1
        ORDER BY m.created_at ASC
      `,
      [ticketId],
    );
    return result.rows;
  }

  async insertTicketEvent(input: {
    ticketId: string;
    storeId: string;
    eventType: string;
    actorType: SupportMessageAuthorType;
    actorCustomerId: string | null;
    actorStoreUserId: string | null;
    actorLabel: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO support_ticket_events (
          id,
          ticket_id,
          store_id,
          event_type,
          actor_type,
          actor_customer_id,
          actor_store_user_id,
          actor_label,
          payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        uuidv4(),
        input.ticketId,
        input.storeId,
        input.eventType,
        input.actorType,
        input.actorCustomerId,
        input.actorStoreUserId,
        input.actorLabel,
        JSON.stringify(input.payload),
      ],
    );
  }

  async listTicketEvents(ticketId: string): Promise<SupportTicketEventRecord[]> {
    const result = await this.databaseService.db.query<SupportTicketEventRecord>(
      `
        SELECT
          e.id,
          e.ticket_id,
          e.store_id,
          e.event_type,
          e.actor_type,
          e.actor_customer_id,
          e.actor_store_user_id,
          e.actor_label,
          c.full_name AS actor_customer_name,
          su.full_name AS actor_store_user_name,
          e.payload,
          e.created_at
        FROM support_ticket_events e
        LEFT JOIN customers c ON c.id = e.actor_customer_id
        LEFT JOIN store_users su ON su.id = e.actor_store_user_id
        WHERE e.ticket_id = $1
        ORDER BY e.created_at ASC
      `,
      [ticketId],
    );
    return result.rows;
  }

  async updateStatus(input: { ticketId: string; status: SupportTicketStatus }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE support_tickets
        SET status = $2,
            resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
            closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE closed_at END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.ticketId, input.status],
    );
  }

  async assignTicket(input: {
    ticketId: string;
    assignedToType: SupportAssigneeType | null;
    assignedToStoreUserId: string | null;
    assignedToLabel: string | null;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE support_tickets
        SET assigned_to_type = $2,
            assigned_to_store_user_id = $3,
            assigned_to_label = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.ticketId, input.assignedToType, input.assignedToStoreUserId, input.assignedToLabel],
    );
  }

  async markFirstResponse(ticketId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE support_tickets
        SET first_response_at = COALESCE(first_response_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
      `,
      [ticketId],
    );
  }

  async findSlaPolicy(input: {
    storeId: string;
    scope: SupportTicketScope;
    priority: SupportTicketPriority;
  }): Promise<{ first_response_minutes: number; resolution_minutes: number } | null> {
    const result = await this.databaseService.db.query<{
      first_response_minutes: number;
      resolution_minutes: number;
    }>(
      `
        SELECT first_response_minutes, resolution_minutes
        FROM support_sla_policies
        WHERE is_active = TRUE
          AND scope = $2
          AND priority = $3
          AND (store_id = $1 OR store_id IS NULL)
        ORDER BY CASE WHEN store_id = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [input.storeId, input.scope, input.priority],
    );

    return result.rows[0] ?? null;
  }
}
