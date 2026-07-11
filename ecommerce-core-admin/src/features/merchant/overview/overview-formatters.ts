export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('ar-SA-u-nu-latn', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

export function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'جديد',
    confirmed: 'مؤكد',
    preparing: 'قيد التجهيز',
    out_for_delivery: 'في الطريق',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    returned: 'مسترجع',
  };

  return labels[status] ?? status;
}

export function transitionLabel(transition: string): string {
  const labels: Record<string, string> = {
    new_to_confirmed: 'جديد -> مؤكد',
    confirmed_to_preparing: 'مؤكد -> تجهيز',
    preparing_to_out_for_delivery: 'تجهيز -> في الطريق',
    out_for_delivery_to_completed: 'في الطريق -> مكتمل',
  };

  return labels[transition] ?? transition;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) {
    return '-';
  }

  if (minutes < 60) {
    return `${Math.round(minutes)} د`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = Math.round(minutes % 60);
  if (hours < 24) {
    return remMinutes > 0 ? `${hours}س ${remMinutes}د` : `${hours}س`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}ي ${remHours}س` : `${days}ي`;
}

export function funnelEventLabel(event: string): string {
  const labels: Record<string, string> = {
    store_visit: 'زيارة المتجر',
    product_view: 'مشاهدة منتج',
    add_to_cart: 'إضافة للسلة',
    checkout_start: 'بدء الدفع',
    checkout_complete: 'إتمام الدفع',
  };

  return labels[event] ?? event;
}

export function qualityCheckLabel(key: string): string {
  const labels: Record<string, string> = {
    orders_without_items: 'طلبات بدون عناصر',
    payments_without_orders: 'مدفوعات بدون طلبات',
    negative_order_totals: 'إجماليات سالبة',
    events_without_session: 'أحداث بدون جلسة',
    events_in_future: 'أحداث مستقبلية',
  };

  return labels[key] ?? key;
}

export function anomalyKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    net_sales: 'صافي المبيعات',
    total_orders: 'إجمالي الطلبات',
    approved_payments: 'المدفوعات المقبولة',
    funnel_conversion: 'تحويل القمع',
  };

  return labels[key] ?? key;
}
