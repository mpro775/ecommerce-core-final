export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  checks?: Record<string, HealthStatus>;
}

export type OutboxEventStatus = 'pending' | 'published' | 'failed';

export interface OutboxEventPayload {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  status: OutboxEventStatus;
  attemptCount: number;
  availableAt: string;
}
