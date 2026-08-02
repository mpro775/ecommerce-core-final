export type CommercialActorType = 'customer' | 'admin' | 'system' | 'worker' | 'integration';

export interface CommercialActor {
  id: string | null;
  type: CommercialActorType;
  permissions: string[];
}

export interface CommercialCommandContext {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CommercialCommandInput {
  storeId: string;
  actor: CommercialActor;
  idempotencyKey: string;
  reason?: string;
  context?: CommercialCommandContext;
}

