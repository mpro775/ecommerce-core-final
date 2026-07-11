import type { OrderStatus, PaymentMethod, PaymentStatus } from '../../types';

export const statusOptions: OrderStatus[] = [
  'new',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
  'returned',
];

export const paymentMethodOptions: PaymentMethod[] = ['cod', 'transfer'];

export const paymentStatusOptions: PaymentStatus[] = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'refunded',
];

export const manualSteps = ['المنتجات', 'العميل', 'الدفع', 'الملخص'];

export const initialStatusCounts: Record<OrderStatus, number> = {
  new: 0,
  confirmed: 0,
  preparing: 0,
  out_for_delivery: 0,
  completed: 0,
  cancelled: 0,
  returned: 0,
};

export const statusLabel: Record<OrderStatus, string> = {
  new: 'جديد',
  confirmed: 'مؤكد',
  preparing: 'قيد التجهيز',
  out_for_delivery: 'في الطريق',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  returned: 'مسترجع',
};

export const statusColor: Record<
  OrderStatus,
  'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success' | 'error'
> = {
  new: 'info',
  confirmed: 'primary',
  preparing: 'warning',
  out_for_delivery: 'secondary',
  completed: 'success',
  cancelled: 'error',
  returned: 'error',
};
