import type { OrderCommand, OrderLifecycleStatus } from './order-transition.types';

export const ORDER_TRANSITION_RULES: Record<
  OrderCommand,
  { from: OrderLifecycleStatus; to: OrderLifecycleStatus; permission: string; requiresReason: boolean }
> = {
  confirmOrder: { from: 'new', to: 'confirmed', permission: 'orders:confirm', requiresReason: false },
  cancelOrder: { from: 'new', to: 'cancelled', permission: 'orders:cancel', requiresReason: true },
  completeOrder: { from: 'confirmed', to: 'completed', permission: 'orders:complete', requiresReason: false },
};

export function orderRule(command: OrderCommand, current: OrderLifecycleStatus) {
  const rule = ORDER_TRANSITION_RULES[command];
  if (command === 'cancelOrder' && current === 'confirmed') {
    return { ...rule, from: 'confirmed' as const };
  }
  return rule;
}

