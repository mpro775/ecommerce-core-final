export type OutboxStatus = 'pending' | 'published' | 'failed';

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  status: OutboxStatus;
  attemptCount: number;
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;
  lastError?: string | null;
}
