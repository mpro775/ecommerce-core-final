import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { NotificationsService } from '../notifications/notifications.service';
import type { CustomerUser } from '../customers/interfaces/customer-user.interface';
import {
  SUPPORT_DEFAULT_SLA_MINUTES,
  type SupportAssigneeType,
  type SupportMessageAuthorType,
  type SupportTicketPriority,
  type SupportTicketScope,
  type SupportTicketStatus,
} from './constants/support.constants';
import type { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';
import type { CreateCustomerSupportTicketDto } from './dto/create-customer-support-ticket.dto';
import type { CreateSupportMessageDto } from './dto/create-support-message.dto';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import type { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import {
  SupportRepository,
  type SupportMessageRecord,
  type SupportTicketEventRecord,
  type SupportTicketRecord,
} from './support.repository';

export interface SupportTicketResponse {
  id: string;
  storeId: string;
  scope: SupportTicketScope;
  source: string;
  subject: string;
  description: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requester: {
    type: string;
    customerId: string | null;
    storeUserId: string | null;
    label: string | null;
    name: string | null;
  };
  assignee: {
    type: SupportAssigneeType | null;
    storeUserId: string | null;
    label: string | null;
    name: string | null;
  };
  sla: {
    firstResponseDueAt: Date | null;
    resolveDueAt: Date | null;
    firstResponseAt: Date | null;
  };
  resolvedAt: Date | null;
  closedAt: Date | null;
  lastMessageAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly supportRepository: SupportRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async createTicketByStoreUser(
    currentUser: AuthUser,
    dto: CreateSupportTicketDto,
    context: RequestContextData,
  ): Promise<SupportTicketResponse> {
    if (dto.scope === 'b2c' && !dto.customerId) {
      throw new BadRequestException('customerId is required for b2c support ticket');
    }

    const sla = await this.resolveSla(currentUser.storeId, dto.scope, dto.priority);
    const ticket = await this.supportRepository.createTicket({
      storeId: currentUser.storeId,
      scope: dto.scope,
      source: 'merchant_portal',
      subject: dto.subject.trim(),
      description: dto.description?.trim() ?? null,
      status: 'open',
      priority: dto.priority,
      requesterType: 'store_user',
      requesterCustomerId: dto.scope === 'b2c' ? (dto.customerId ?? null) : null,
      requesterStoreUserId: currentUser.id,
      requesterLabel: currentUser.fullName,
      assignedToType: null,
      assignedToStoreUserId: null,
      assignedToLabel: null,
      slaFirstResponseDueAt: sla.firstResponseDueAt,
      slaResolveDueAt: sla.resolveDueAt,
      metadata: {},
    });

    await this.supportRepository.insertMessage({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      authorType: 'store_user',
      authorCustomerId: null,
      authorStoreUserId: currentUser.id,
      authorLabel: currentUser.fullName,
      message: dto.message.trim(),
      isInternal: false,
    });

    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType: 'support.ticket.created',
      actorType: 'store_user',
      actorCustomerId: null,
      actorStoreUserId: currentUser.id,
      actorLabel: currentUser.fullName,
      payload: {
        scope: ticket.scope,
        priority: ticket.priority,
      },
    });

    await this.auditService.log({
      action: 'support.ticket.created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        scope: ticket.scope,
        priority: ticket.priority,
      },
    });

    await this.notifyOnTicketCreated(ticket, dto.message.trim());
    return this.mapTicket(ticket);
  }

  async createTicketByCustomer(
    customer: CustomerUser,
    dto: CreateCustomerSupportTicketDto,
    context: RequestContextData,
  ): Promise<SupportTicketResponse> {
    const sla = await this.resolveSla(customer.storeId, 'b2c', dto.priority);
    const ticket = await this.supportRepository.createTicket({
      storeId: customer.storeId,
      scope: 'b2c',
      source: 'customer_portal',
      subject: dto.subject.trim(),
      description: dto.description?.trim() ?? null,
      status: 'open',
      priority: dto.priority,
      requesterType: 'customer',
      requesterCustomerId: customer.id,
      requesterStoreUserId: null,
      requesterLabel: customer.fullName,
      assignedToType: null,
      assignedToStoreUserId: null,
      assignedToLabel: null,
      slaFirstResponseDueAt: sla.firstResponseDueAt,
      slaResolveDueAt: sla.resolveDueAt,
      metadata: {},
    });

    await this.supportRepository.insertMessage({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      authorType: 'customer',
      authorCustomerId: customer.id,
      authorStoreUserId: null,
      authorLabel: customer.fullName,
      message: dto.message.trim(),
      isInternal: false,
    });

    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType: 'support.ticket.created',
      actorType: 'customer',
      actorCustomerId: customer.id,
      actorStoreUserId: null,
      actorLabel: customer.fullName,
      payload: {
        scope: ticket.scope,
        priority: ticket.priority,
      },
    });

    await this.notifyOnTicketCreated(ticket, dto.message.trim());
    await this.auditService.log({
      action: 'support.ticket.created_by_customer',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.mapTicket(ticket);
  }

  async listTicketsForStore(
    currentUser: AuthUser,
    query: ListSupportTicketsQueryDto,
  ): Promise<{ items: SupportTicketResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.supportRepository.listTickets({
      storeId: currentUser.storeId,
      page,
      limit,
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
    });
    return {
      items: result.rows.map((row) => this.mapTicket(row)),
      total: result.total,
      page,
      limit,
    };
  }

  async listTicketsForCustomer(
    customer: CustomerUser,
    query: ListSupportTicketsQueryDto,
  ): Promise<{ items: SupportTicketResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.supportRepository.listTickets({
      storeId: customer.storeId,
      page,
      limit,
      requesterCustomerId: customer.id,
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
    });
    return {
      items: result.rows.map((row) => this.mapTicket(row)),
      total: result.total,
      page,
      limit,
    };
  }

  async getTicketForStore(currentUser: AuthUser, ticketId: string) {
    const ticket = await this.mustFindTicket(currentUser.storeId, ticketId);
    const [messages, events] = await Promise.all([
      this.supportRepository.listMessages(ticket.id),
      this.supportRepository.listTicketEvents(ticket.id),
    ]);

    return {
      ticket: this.mapTicket(ticket),
      messages: messages.map((item) => this.mapMessage(item)),
      events: events.map((item) => this.mapEvent(item)),
    };
  }

  async getTicketForCustomer(customer: CustomerUser, ticketId: string) {
    const ticket = await this.mustFindTicket(customer.storeId, ticketId);
    if (ticket.requester_customer_id !== customer.id) {
      throw new NotFoundException('Support ticket not found');
    }

    const [messages, events] = await Promise.all([
      this.supportRepository.listMessages(ticket.id),
      this.supportRepository.listTicketEvents(ticket.id),
    ]);

    return {
      ticket: this.mapTicket(ticket),
      messages: messages.filter((item) => !item.is_internal).map((item) => this.mapMessage(item)),
      events: events.map((item) => this.mapEvent(item)),
    };
  }

  async addMessageByStoreUser(
    currentUser: AuthUser,
    ticketId: string,
    dto: CreateSupportMessageDto,
    context: RequestContextData,
  ) {
    const ticket = await this.mustFindTicket(currentUser.storeId, ticketId);
    const message = await this.supportRepository.insertMessage({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      authorType: 'store_user',
      authorCustomerId: null,
      authorStoreUserId: currentUser.id,
      authorLabel: currentUser.fullName,
      message: dto.message.trim(),
      isInternal: dto.isInternal ?? false,
    });

    if (!message.is_internal) {
      const nextStatus: SupportTicketStatus =
        ticket.scope === 'b2c' ? 'waiting_customer' : 'waiting_agent';
      if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
        await this.supportRepository.updateStatus({ ticketId: ticket.id, status: nextStatus });
      }
      if (ticket.first_response_at === null && ticket.requester_type !== 'store_user') {
        await this.supportRepository.markFirstResponse(ticket.id);
      }
      await this.notifyOnMessage(ticket, message);
    }

    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType: 'support.ticket.updated',
      actorType: 'store_user',
      actorCustomerId: null,
      actorStoreUserId: currentUser.id,
      actorLabel: currentUser.fullName,
      payload: {
        updateType: 'message_added',
        internal: message.is_internal,
      },
    });

    await this.auditService.log({
      action: 'support.ticket.message_added',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, internal: message.is_internal },
    });

    return this.mapMessage(message);
  }

  async addMessageByCustomer(
    customer: CustomerUser,
    ticketId: string,
    dto: CreateSupportMessageDto,
    context: RequestContextData,
  ) {
    const ticket = await this.mustFindTicket(customer.storeId, ticketId);
    if (ticket.requester_customer_id !== customer.id) {
      throw new NotFoundException('Support ticket not found');
    }

    const message = await this.supportRepository.insertMessage({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      authorType: 'customer',
      authorCustomerId: customer.id,
      authorStoreUserId: null,
      authorLabel: customer.fullName,
      message: dto.message.trim(),
      isInternal: false,
    });

    if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
      await this.supportRepository.updateStatus({ ticketId: ticket.id, status: 'waiting_agent' });
    }
    await this.notifyOnMessage(ticket, message);

    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType: 'support.ticket.updated',
      actorType: 'customer',
      actorCustomerId: customer.id,
      actorStoreUserId: null,
      actorLabel: customer.fullName,
      payload: {
        updateType: 'message_added',
      },
    });

    await this.auditService.log({
      action: 'support.ticket.message_added_by_customer',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.mapMessage(message);
  }

  async updateStatusByStoreUser(
    currentUser: AuthUser,
    ticketId: string,
    dto: UpdateSupportTicketStatusDto,
    context: RequestContextData,
  ) {
    const ticket = await this.mustFindTicket(currentUser.storeId, ticketId);
    await this.supportRepository.updateStatus({ ticketId: ticket.id, status: dto.status });
    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType:
        dto.status === 'resolved' || dto.status === 'closed'
          ? 'support.ticket.resolved'
          : 'support.ticket.updated',
      actorType: 'store_user',
      actorCustomerId: null,
      actorStoreUserId: currentUser.id,
      actorLabel: currentUser.fullName,
      payload: {
        updateType: 'status_changed',
        status: dto.status,
      },
    });

    await this.notifyOnStatusUpdate(ticket, dto.status);
    await this.auditService.log({
      action: 'support.ticket.status_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, status: dto.status },
    });

    const updated = await this.mustFindTicket(currentUser.storeId, ticket.id);
    return this.mapTicket(updated);
  }

  async updateStatusByCustomer(
    customer: CustomerUser,
    ticketId: string,
    dto: UpdateSupportTicketStatusDto,
    context: RequestContextData,
  ) {
    if (!['resolved', 'closed', 'open'].includes(dto.status)) {
      throw new BadRequestException('Customer can only set status to open, resolved, or closed');
    }

    const ticket = await this.mustFindTicket(customer.storeId, ticketId);
    if (ticket.requester_customer_id !== customer.id) {
      throw new NotFoundException('Support ticket not found');
    }

    await this.supportRepository.updateStatus({ ticketId: ticket.id, status: dto.status });
    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType:
        dto.status === 'resolved' || dto.status === 'closed'
          ? 'support.ticket.resolved'
          : 'support.ticket.updated',
      actorType: 'customer',
      actorCustomerId: customer.id,
      actorStoreUserId: null,
      actorLabel: customer.fullName,
      payload: {
        updateType: 'status_changed',
        status: dto.status,
      },
    });

    await this.notifyOnStatusUpdate(ticket, dto.status);
    await this.auditService.log({
      action: 'support.ticket.status_updated_by_customer',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, status: dto.status },
    });

    const updated = await this.mustFindTicket(customer.storeId, ticket.id);
    return this.mapTicket(updated);
  }

  async assignByStoreUser(
    currentUser: AuthUser,
    ticketId: string,
    dto: AssignSupportTicketDto,
    context: RequestContextData,
  ) {
    const ticket = await this.mustFindTicket(currentUser.storeId, ticketId);
    await this.supportRepository.assignTicket({
      ticketId: ticket.id,
      assignedToType: dto.assignedToType ?? null,
      assignedToStoreUserId: dto.assignedToStoreUserId ?? null,
      assignedToLabel: dto.assignedToLabel?.trim() ?? null,
    });

    await this.supportRepository.insertTicketEvent({
      ticketId: ticket.id,
      storeId: ticket.store_id,
      eventType: 'support.ticket.assigned',
      actorType: 'store_user',
      actorCustomerId: null,
      actorStoreUserId: currentUser.id,
      actorLabel: currentUser.fullName,
      payload: {
        assignedToType: dto.assignedToType ?? null,
        assignedToStoreUserId: dto.assignedToStoreUserId ?? null,
        assignedToLabel: dto.assignedToLabel?.trim() ?? null,
      },
    });

    if (dto.assignedToStoreUserId) {
      await this.notificationsService.createInboxNotification({
        storeId: currentUser.storeId,
        recipientType: 'store_user',
        recipientStoreUserId: dto.assignedToStoreUserId,
        recipientCustomerId: null,
        type: 'support.ticket.assigned',
        title: `Ticket assigned: ${ticket.subject}`,
        body: `A support ticket was assigned to you (#${ticket.id.slice(0, 8)}).`,
        actionUrl: `/merchant?tab=supportTickets&ticketId=${encodeURIComponent(ticket.id)}`,
        metadata: {
          ticketId: ticket.id,
          scope: ticket.scope,
        },
      });
    }

    await this.auditService.log({
      action: 'support.ticket.assigned',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        assignedToType: dto.assignedToType ?? null,
        assignedToStoreUserId: dto.assignedToStoreUserId ?? null,
      },
    });

    const updated = await this.mustFindTicket(currentUser.storeId, ticket.id);
    return this.mapTicket(updated);
  }

  private async notifyOnTicketCreated(
    ticket: SupportTicketRecord,
    firstMessage: string,
  ): Promise<void> {
    if (ticket.scope === 'b2c') {
      if (ticket.requester_customer_id) {
        await this.notificationsService.createInboxNotification({
          storeId: ticket.store_id,
          recipientType: 'store',
          recipientStoreUserId: null,
          recipientCustomerId: null,
          type: 'support.ticket.created',
          title: `New customer support ticket: ${ticket.subject}`,
          body: firstMessage.slice(0, 300),
          actionUrl: `/merchant?tab=supportTickets&ticketId=${encodeURIComponent(ticket.id)}`,
          metadata: {
            ticketId: ticket.id,
            scope: ticket.scope,
            priority: ticket.priority,
          },
        });
      } else {
        await this.notificationsService.createInboxNotification({
          storeId: ticket.store_id,
          recipientType: 'customer',
          recipientStoreUserId: null,
          recipientCustomerId: null,
          type: 'support.ticket.created',
          title: `Support ticket created: ${ticket.subject}`,
          body: firstMessage.slice(0, 300),
          actionUrl: `/account`,
          metadata: {
            ticketId: ticket.id,
          },
        });
      }
      return;
    }

    await this.notificationsService.createInboxNotification({
      storeId: ticket.store_id,
      recipientType: 'store',
      recipientStoreUserId: null,
      recipientCustomerId: null,
      type: 'support.ticket.created',
      title: `Merchant support ticket created: ${ticket.subject}`,
      body: firstMessage.slice(0, 300),
      actionUrl: null,
      metadata: {
        ticketId: ticket.id,
        scope: ticket.scope,
      },
    });
  }

  private async notifyOnMessage(
    ticket: SupportTicketRecord,
    message: SupportMessageRecord,
  ): Promise<void> {
    if (ticket.scope === 'b2c') {
      if (message.author_type === 'customer') {
        await this.notificationsService.createInboxNotification({
          storeId: ticket.store_id,
          recipientType: 'store',
          recipientStoreUserId: null,
          recipientCustomerId: null,
          type: 'support.ticket.updated',
          title: `Customer replied: ${ticket.subject}`,
          body: message.message.slice(0, 300),
          actionUrl: `/merchant?tab=supportTickets&ticketId=${encodeURIComponent(ticket.id)}`,
          metadata: { ticketId: ticket.id },
        });
      } else if (ticket.requester_customer_id) {
        await this.notificationsService.createInboxNotification({
          storeId: ticket.store_id,
          recipientType: 'customer',
          recipientStoreUserId: null,
          recipientCustomerId: ticket.requester_customer_id,
          type: 'support.ticket.updated',
          title: `Support replied: ${ticket.subject}`,
          body: message.message.slice(0, 300),
          actionUrl: `/account`,
          metadata: { ticketId: ticket.id },
        });
      }
      return;
    }

    if (message.author_type === 'store_user') {
      await this.notificationsService.createInboxNotification({
        storeId: ticket.store_id,
        recipientType: 'store',
        recipientStoreUserId: null,
        recipientCustomerId: null,
        type: 'support.ticket.updated',
        title: `Merchant replied: ${ticket.subject}`,
        body: message.message.slice(0, 300),
        actionUrl: null,
        metadata: { ticketId: ticket.id },
      });
    } else {
      await this.notificationsService.createInboxNotification({
        storeId: ticket.store_id,
        recipientType: 'store',
        recipientStoreUserId: null,
        recipientCustomerId: null,
        type: 'support.ticket.updated',
        title: `Platform replied: ${ticket.subject}`,
        body: message.message.slice(0, 300),
        actionUrl: `/merchant?tab=supportTickets&ticketId=${encodeURIComponent(ticket.id)}`,
        metadata: { ticketId: ticket.id },
      });
    }
  }

  private async notifyOnStatusUpdate(
    ticket: SupportTicketRecord,
    status: SupportTicketStatus,
  ): Promise<void> {
    if (ticket.scope === 'b2c') {
      if (ticket.requester_customer_id) {
        await this.notificationsService.createInboxNotification({
          storeId: ticket.store_id,
          recipientType: 'customer',
          recipientStoreUserId: null,
          recipientCustomerId: ticket.requester_customer_id,
          type: 'support.ticket.updated',
          title: `Ticket status updated: ${ticket.subject}`,
          body: `Status changed to ${status}.`,
          actionUrl: `/account`,
          metadata: { ticketId: ticket.id, status },
        });
      }
      return;
    }

    await this.notificationsService.createInboxNotification({
      storeId: ticket.store_id,
      recipientType: 'store',
      recipientStoreUserId: null,
      recipientCustomerId: null,
      type: status === 'resolved' ? 'support.ticket.resolved' : 'support.ticket.updated',
      title: `Merchant ticket status changed: ${ticket.subject}`,
      body: `Status changed to ${status}.`,
      actionUrl: null,
      metadata: { ticketId: ticket.id, status },
    });
  }

  private async resolveSla(
    storeId: string,
    scope: SupportTicketScope,
    priority: SupportTicketPriority,
  ): Promise<{ firstResponseDueAt: Date; resolveDueAt: Date }> {
    const policy = await this.supportRepository.findSlaPolicy({ storeId, scope, priority });
    const baseline = policy
      ? {
          firstResponse: policy.first_response_minutes,
          resolution: policy.resolution_minutes,
        }
      : SUPPORT_DEFAULT_SLA_MINUTES[priority];

    return {
      firstResponseDueAt: new Date(Date.now() + baseline.firstResponse * 60 * 1000),
      resolveDueAt: new Date(Date.now() + baseline.resolution * 60 * 1000),
    };
  }

  private async mustFindTicket(storeId: string, ticketId: string): Promise<SupportTicketRecord> {
    const ticket = await this.supportRepository.findTicketById(storeId, ticketId);
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }
    return ticket;
  }

  private mapTicket(row: SupportTicketRecord): SupportTicketResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      scope: row.scope,
      source: row.source,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      requester: {
        type: row.requester_type,
        customerId: row.requester_customer_id,
        storeUserId: row.requester_store_user_id,
        label: row.requester_label,
        name: row.requester_customer_name ?? row.requester_store_user_name ?? row.requester_label,
      },
      assignee: {
        type: row.assigned_to_type,
        storeUserId: row.assigned_to_store_user_id,
        label: row.assigned_to_label,
        name: row.assigned_store_user_name ?? row.assigned_to_label,
      },
      sla: {
        firstResponseDueAt: row.sla_first_response_due_at,
        resolveDueAt: row.sla_resolve_due_at,
        firstResponseAt: row.first_response_at,
      },
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      lastMessageAt: row.last_message_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMessage(row: SupportMessageRecord): Record<string, unknown> {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      storeId: row.store_id,
      authorType: row.author_type,
      authorCustomerId: row.author_customer_id,
      authorStoreUserId: row.author_store_user_id,
      authorName: row.author_customer_name ?? row.author_store_user_name ?? row.author_label,
      authorLabel: row.author_label,
      message: row.message,
      isInternal: row.is_internal,
      attachments: row.attachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEvent(row: SupportTicketEventRecord): Record<string, unknown> {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      storeId: row.store_id,
      eventType: row.event_type,
      actorType: row.actor_type,
      actorCustomerId: row.actor_customer_id,
      actorStoreUserId: row.actor_store_user_id,
      actorName: row.actor_customer_name ?? row.actor_store_user_name ?? row.actor_label,
      actorLabel: row.actor_label,
      payload: row.payload,
      createdAt: row.created_at,
    };
  }
}
