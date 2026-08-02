export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
  deduplicationKey: string;
}
