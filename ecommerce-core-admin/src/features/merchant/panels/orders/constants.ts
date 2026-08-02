import type { OrderStatus, PaymentMethod } from '../../types';

export const paymentMethodOptions: PaymentMethod[] = ['cod', 'transfer'];
export const manualSteps = ['المنتجات', 'العميل', 'الدفع', 'الملخص'];

export function statusColor(status: OrderStatus):
  'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error' {
  if (status === 'new') return 'info';
  if (status === 'confirmed') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'error';
  return 'default';
}
