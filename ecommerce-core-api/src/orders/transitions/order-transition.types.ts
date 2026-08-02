import type { CommercialCommandInput } from '../../commercial/commercial.types';

export type OrderCommand = 'confirmOrder' | 'cancelOrder' | 'completeOrder';
export type OrderLifecycleStatus = 'new' | 'confirmed' | 'completed' | 'cancelled';

export interface OrderTransitionInput extends CommercialCommandInput {
  orderId: string;
  command: OrderCommand;
  expectedVersion?: number;
}

export interface OrderTransitionResult extends Record<string, unknown> {
  id: string;
  orderNumber: string;
  status: OrderLifecycleStatus;
  fulfillmentStatus: string;
  version: string;
}
