export const SUPPORT_TICKET_SCOPES = ['b2b', 'b2c'] as const;
export type SupportTicketScope = (typeof SUPPORT_TICKET_SCOPES)[number];

export const SUPPORT_TICKET_SOURCES = [
  'merchant_portal',
  'customer_portal',
  'platform_console',
  'system',
] as const;
export type SupportTicketSource = (typeof SUPPORT_TICKET_SOURCES)[number];

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];

export const SUPPORT_REQUESTER_TYPES = ['customer', 'store_user', 'platform'] as const;
export type SupportRequesterType = (typeof SUPPORT_REQUESTER_TYPES)[number];

export const SUPPORT_MESSAGE_AUTHOR_TYPES = [
  'customer',
  'store_user',
  'platform_agent',
  'system',
] as const;
export type SupportMessageAuthorType = (typeof SUPPORT_MESSAGE_AUTHOR_TYPES)[number];

export const SUPPORT_ASSIGNEE_TYPES = ['store_user', 'platform_agent'] as const;
export type SupportAssigneeType = (typeof SUPPORT_ASSIGNEE_TYPES)[number];

export const SUPPORT_DEFAULT_SLA_MINUTES: Record<
  SupportTicketPriority,
  { firstResponse: number; resolution: number }
> = {
  low: { firstResponse: 240, resolution: 4320 },
  medium: { firstResponse: 120, resolution: 2880 },
  high: { firstResponse: 60, resolution: 1440 },
  urgent: { firstResponse: 30, resolution: 720 },
};
