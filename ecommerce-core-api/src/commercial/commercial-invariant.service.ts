import { Injectable, NotFoundException } from '@nestjs/common';
import type { QueryExecutor } from '../database/query-executor';
import { CommercialDomainException } from './commercial.errors';

export interface LockedOrderAggregate {
  order: {
    id: string;
    store_id: string;
    order_code: string;
    customer_id: string | null;
    status: 'new' | 'confirmed' | 'completed' | 'cancelled';
    fulfillment_type: 'delivery' | 'pickup' | 'external_shipping' | 'manual_coordination';
    fulfillment_status: 'unfulfilled' | 'preparing' | 'ready' | 'out_for_delivery' | 'fulfilled' | 'failed' | 'cancelled';
    subtotal: string;
    shipping_fee: string;
    discount_total: string;
    tax_amount: string;
    total: string;
    paid_amount: string;
    refunded_amount: string;
    currency_code: string;
    shipping_address: Record<string, unknown>;
    version: string;
  };
  payment: {
    id: string;
    method: string;
    payment_method_code: string | null;
    status: string;
    amount: string;
    paid_amount: string;
    refunded_amount: string;
    version: string;
  } | null;
  itemCount: number;
  lineTotal: string;
  stockManagedItemCount: number;
  reservations: Array<{
    id: string;
    variant_id: string;
    warehouse_id: string | null;
    quantity: number;
    status: string;
  }>;
}

@Injectable()
export class CommercialInvariantService {
  async loadLockedOrder(
    db: QueryExecutor,
    storeId: string,
    orderId: string,
  ): Promise<LockedOrderAggregate> {
    const orderResult = await db.query<LockedOrderAggregate['order']>(
      `SELECT id, store_id, order_code, customer_id, status, fulfillment_type,
              fulfillment_status, subtotal, shipping_fee, discount_total, tax_amount,
              total, paid_amount, refunded_amount, currency_code, shipping_address,
              version::text
       FROM orders WHERE store_id = $1 AND id = $2 FOR UPDATE`,
      [storeId, orderId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new NotFoundException('Order not found');

    const paymentResult = await db.query<NonNullable<LockedOrderAggregate['payment']>>(
        `SELECT id, method, payment_method_code, status, amount, paid_amount,
                refunded_amount, version::text
         FROM payments WHERE store_id = $1 AND order_id = $2 FOR UPDATE`,
        [storeId, orderId],
      );
    const itemResult = await db.query<{
      item_count: number; line_total: string; stock_managed_count: number;
    }>(
        `SELECT COUNT(*)::int AS item_count,
                COALESCE(SUM(oi.line_total), 0)::text AS line_total,
                COUNT(*) FILTER (WHERE p.stock_unlimited = FALSE)::int AS stock_managed_count
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.store_id = $1 AND oi.order_id = $2`,
        [storeId, orderId],
      );
    const reservationsResult = await db.query<LockedOrderAggregate['reservations'][number]>(
        `SELECT id, variant_id, warehouse_id, quantity, status
         FROM inventory_reservations
         WHERE store_id = $1 AND order_id = $2
         ORDER BY id FOR UPDATE`,
        [storeId, orderId],
      );
    const item = itemResult.rows[0] ?? { item_count: 0, line_total: '0', stock_managed_count: 0 };
    return {
      order,
      payment: paymentResult.rows[0] ?? null,
      itemCount: item.item_count,
      lineTotal: item.line_total,
      stockManagedItemCount: item.stock_managed_count,
      reservations: reservationsResult.rows,
    };
  }

  assertConfirmable(state: LockedOrderAggregate): void {
    if (state.order.status !== 'new') {
      throw new CommercialDomainException('ORDER_TRANSITION_NOT_ALLOWED', 'Only a new order can be confirmed');
    }
    if (state.itemCount < 1) {
      throw new CommercialDomainException('ORDER_TRANSITION_NOT_ALLOWED', 'Order has no items');
    }
    const expected = this.minor(state.lineTotal) + this.minor(state.order.shipping_fee) +
      this.minor(state.order.tax_amount);
    if (expected !== this.minor(state.order.total)) {
      throw new CommercialDomainException('PAYMENT_AMOUNT_INCONSISTENT', 'Order item snapshots do not reconcile with total');
    }
    if (!state.payment) {
      throw new CommercialDomainException('ORDER_PAYMENT_GATE_NOT_SATISFIED', 'Payment record is required');
    }
    if (this.minor(state.payment.amount) !== this.minor(state.order.total)) {
      throw new CommercialDomainException('PAYMENT_AMOUNT_INCONSISTENT', 'Payment amount does not match order total');
    }
    if (['rejected', 'expired', 'cancelled', 'partially_refunded', 'refunded'].includes(state.payment.status)) {
      throw new CommercialDomainException('ORDER_PAYMENT_GATE_NOT_SATISFIED', 'Payment state contradicts confirmation');
    }
    if (state.order.fulfillment_status !== 'unfulfilled') {
      throw new CommercialDomainException('ORDER_TRANSITION_NOT_ALLOWED', 'Fulfillment has already progressed');
    }
    if (state.stockManagedItemCount > 0 && !state.reservations.some((row) => row.status === 'active')) {
      throw new CommercialDomainException('ORDER_HAS_ACTIVE_RESERVATION', 'An active inventory reservation is required');
    }
  }

  assertCompletable(state: LockedOrderAggregate): void {
    if (state.order.status !== 'confirmed') {
      throw new CommercialDomainException('ORDER_TRANSITION_NOT_ALLOWED', 'Only a confirmed order can be completed');
    }
    if (state.order.fulfillment_status !== 'fulfilled') {
      throw new CommercialDomainException('ORDER_FULFILLMENT_NOT_COMPLETE', 'Fulfillment must be fulfilled');
    }
    if (!state.payment || state.payment.status !== 'approved') {
      throw new CommercialDomainException('ORDER_PAYMENT_GATE_NOT_SATISFIED', 'Approved payment is required');
    }
    const method = state.payment.payment_method_code ?? state.payment.method;
    const paid = this.minor(state.payment.paid_amount);
    if (paid <= 0 || (method === 'cod' && paid !== this.minor(state.payment.amount))) {
      throw new CommercialDomainException('PAYMENT_AMOUNT_INCONSISTENT', 'Paid amount is inconsistent');
    }
    if (state.reservations.some((row) => row.status === 'active')) {
      throw new CommercialDomainException('ORDER_HAS_ACTIVE_RESERVATION', 'Active reservations must be reconciled');
    }
  }

  assertFulfillmentPaymentGate(state: LockedOrderAggregate, override = false): void {
    if (!state.payment) {
      throw new CommercialDomainException('FULFILLMENT_PAYMENT_GATE_NOT_SATISFIED', 'Payment record is required');
    }
    const method = state.payment.payment_method_code ?? state.payment.method;
    const allowed = method === 'cod'
      ? ['pending', 'approved'].includes(state.payment.status)
      : state.payment.status === 'approved';
    if (!allowed && !override) {
      throw new CommercialDomainException(
        'FULFILLMENT_PAYMENT_GATE_NOT_SATISFIED',
        'Payment approval is required before fulfillment',
      );
    }
  }

  private minor(value: string): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      throw new CommercialDomainException('PAYMENT_AMOUNT_INCONSISTENT', 'Invalid monetary projection');
    }
    return Math.round(normalized * 100);
  }
}
