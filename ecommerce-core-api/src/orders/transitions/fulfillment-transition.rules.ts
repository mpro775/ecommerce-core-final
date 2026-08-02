export type FulfillmentType = 'delivery' | 'pickup' | 'external_shipping' | 'manual_coordination';
export type FulfillmentStatus = 'unfulfilled' | 'preparing' | 'ready' | 'out_for_delivery' |
  'fulfilled' | 'failed' | 'cancelled';
export type FulfillmentCommand = 'startPreparing' | 'overrideStartPreparing' | 'markReady' |
  'dispatch' | 'markFulfilled' | 'markFailed' | 'retryDispatch' | 'cancelFulfillment';

export interface FulfillmentRule {
  from: FulfillmentStatus[];
  to: FulfillmentStatus;
  types: FulfillmentType[];
  permission: string;
  reasonRequired: boolean;
  paymentGate: boolean;
  eventType: string;
}

const ALL_TYPES: FulfillmentType[] = ['delivery', 'pickup', 'external_shipping', 'manual_coordination'];

export const FULFILLMENT_RULES: Record<FulfillmentCommand, FulfillmentRule> = {
  startPreparing: { from: ['unfulfilled'], to: 'preparing', types: ALL_TYPES,
    permission: 'fulfillment:start-preparing', reasonRequired: false, paymentGate: true,
    eventType: 'fulfillment.preparing' },
  overrideStartPreparing: { from: ['unfulfilled'], to: 'preparing', types: ALL_TYPES,
    permission: 'orders:override-payment-gate', reasonRequired: true, paymentGate: false,
    eventType: 'fulfillment.payment_gate_overridden' },
  markReady: { from: ['preparing'], to: 'ready', types: ALL_TYPES,
    permission: 'fulfillment:mark-ready', reasonRequired: false, paymentGate: true,
    eventType: 'fulfillment.ready' },
  dispatch: { from: ['ready'], to: 'out_for_delivery', types: ['delivery'],
    permission: 'fulfillment:dispatch', reasonRequired: false, paymentGate: true,
    eventType: 'fulfillment.dispatched' },
  markFulfilled: { from: ['out_for_delivery', 'ready'], to: 'fulfilled', types: ALL_TYPES,
    permission: 'fulfillment:fulfill', reasonRequired: false, paymentGate: true,
    eventType: 'fulfillment.fulfilled' },
  markFailed: { from: ['out_for_delivery'], to: 'failed', types: ['delivery'],
    permission: 'fulfillment:fail', reasonRequired: true, paymentGate: false,
    eventType: 'fulfillment.failed' },
  retryDispatch: { from: ['failed'], to: 'out_for_delivery', types: ['delivery'],
    permission: 'fulfillment:retry', reasonRequired: true, paymentGate: true,
    eventType: 'fulfillment.dispatched' },
  cancelFulfillment: { from: ['unfulfilled', 'preparing', 'ready', 'failed'], to: 'cancelled',
    types: ALL_TYPES, permission: 'fulfillment:cancel', reasonRequired: true, paymentGate: false,
    eventType: 'fulfillment.cancelled' },
};

export function getFulfillmentRule(command: FulfillmentCommand, type: FulfillmentType,
  status: FulfillmentStatus): FulfillmentRule {
  const rule = FULFILLMENT_RULES[command];
  if (!rule.types.includes(type) || !rule.from.includes(status)) {
    throw new Error('FULFILLMENT_TRANSITION_NOT_ALLOWED');
  }
  if (command === 'markFulfilled' && type === 'delivery' && status !== 'out_for_delivery') {
    throw new Error('FULFILLMENT_TRANSITION_NOT_ALLOWED');
  }
  if (command === 'markFulfilled' && type !== 'delivery' && status !== 'ready') {
    throw new Error('FULFILLMENT_TRANSITION_NOT_ALLOWED');
  }
  return rule;
}
