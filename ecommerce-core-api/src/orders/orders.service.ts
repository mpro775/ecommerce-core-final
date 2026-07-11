import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import {
  InventoryService,
  type BackInStockSignal,
  type InventoryOrderItemInput,
  type LowStockSignal,
} from '../inventory/inventory.service';
import type { Queryable } from '../inventory/inventory.repository';
import { OutboxService } from '../messaging/outbox.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ShippingCalculatorService } from '../shipping/shipping-calculator.service';
import { ShippingRepository } from '../shipping/shipping.repository';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  canTransitionOrderStatus,
  ORDER_STATUSES,
  type OrderStatus,
} from './constants/order-status.constants';
import type { PaymentMethod } from './constants/payment.constants';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import type { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import type { ManualOrderProductSearchQueryDto } from './dto/manual-order-product-search-query.dto';
import type { OrdersExportQueryDto } from './dto/orders-export-query.dto';
import type { UpdateManualOrderDto } from './dto/update-manual-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  OrdersRepository,
  type CustomerAddressSummaryRow,
  type CustomerSummaryRow,
  type ManualProductSearchRow,
  type OrderItemRecord,
  type OrderListRow,
  type OrderRecord,
  type OrderStatusHistoryRecord,
  type PaymentStatus,
  type StoreVariantSnapshot,
} from './orders.repository';

const MANUAL_EDITABLE_STATUSES: OrderStatus[] = ['new', 'confirmed', 'preparing'];
const EDITABLE_PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'under_review', 'rejected'];

interface ManualResolvedLine {
  productId: string;
  variantId: string;
  title: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineDiscount: number;
  lineTotal: number;
  attributes: Record<string, string>;
  stockUnlimited: boolean;
  productWeight: number | null;
}

interface ManualOrderComputation {
  customer: CustomerSummaryRow;
  shippingAddress: Record<string, unknown>;
  shippingZoneId: string | null;
  shippingMethodId: string | null;
  shippingMethodSnapshot: Record<string, unknown> | null;
  shippingMethodType: string | null;
  shippingFee: number;
  couponCode: string | null;
  couponId: string | null;
  lines: ManualResolvedLine[];
  inventoryItems: InventoryOrderItemInput[];
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string | null;
  paymentMethod: PaymentMethod;
}

export interface OrderResponse {
  id: string;
  orderCode: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  currencyCode: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  };
  paymentMethod: PaymentMethod | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  paymentStatus: PaymentStatus | null;
}

export interface OrderDetailResponse extends OrderResponse {
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    sku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  timeline: Array<{
    from: string | null;
    to: string;
    note: string | null;
    createdAt: Date;
  }>;
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    receiptUrl: string | null;
    paymentMethodCode: string | null;
    paymentMethodName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    phoneNumber: string | null;
    iban: string | null;
    instructionsAr: string | null;
    instructionsEn: string | null;
    payerReference: string | null;
    payerReceiptUrl: string | null;
    payerReceiptMediaAssetId: string | null;
    payerNote: string | null;
    customerSubmittedAt: Date | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
  } | null;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly inventoryService: InventoryService,
    private readonly promotionsService: PromotionsService,
    private readonly shippingRepository: ShippingRepository,
    private readonly shippingCalculatorService: ShippingCalculatorService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly webhooksService: WebhooksService,
    private readonly loyaltyService: LoyaltyService,
    private readonly affiliatesService: AffiliatesService,
  ) {}

  async list(currentUser: AuthUser, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = this.normalizeListFilters(currentUser.storeId, query);
    const result = await this.ordersRepository.listOrders({
      ...filters,
      limit,
      offset: (page - 1) * limit,
    });
    const counts = await this.ordersRepository.listOrderStatusCounts({
      storeId: currentUser.storeId,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    });

    return {
      items: result.rows.map((order) => this.mapListOrder(order)),
      total: result.total,
      page,
      limit,
      statusCounts: this.mapStatusCounts(counts),
    };
  }

  async exportToExcel(currentUser: AuthUser, query: OrdersExportQueryDto): Promise<Buffer> {
    const filters = this.normalizeListFilters(currentUser.storeId, query);
    const orders = await this.ordersRepository.listOrdersForExport(filters);
    const items = await this.ordersRepository.listOrderItemsByOrderIds(
      orders.map((order) => order.id),
    );

    const summaryRows = orders.map((order) => ({
      order_code: order.order_code,
      status: order.status,
      customer_name: order.customer_name ?? '',
      customer_phone: order.customer_phone ?? '',
      payment_method: order.payment_method ?? '',
      payment_status: order.payment_status ?? '',
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      shipping_fee: Number(order.shipping_fee),
      discount_total: Number(order.discount_total),
      coupon_code: order.coupon_code ?? '',
      currency_code: order.currency_code,
      created_at: order.created_at.toISOString(),
      note: order.note ?? '',
    }));

    const orderById = new Map(orders.map((order) => [order.id, order] as const));
    const itemRows = items.map((item) => ({
      order_code: orderById.get(item.order_id)?.order_code ?? '',
      variant_id: item.variant_id,
      product_id: item.product_id,
      title: item.title,
      sku: item.sku,
      unit_price: Number(item.unit_price),
      quantity: item.quantity,
      line_total: Number(item.line_total),
    }));

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const itemsSheet = XLSX.utils.json_to_sheet(itemRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'orders_summary');
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'orders_items');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async searchManualProducts(currentUser: AuthUser, query: ManualOrderProductSearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.ordersRepository.searchManualProducts({
      storeId: currentUser.storeId,
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => this.mapManualProduct(row)),
      total: result.total,
      page,
      limit,
    };
  }

  async createManual(
    currentUser: AuthUser,
    input: CreateManualOrderDto,
    context: RequestContextData,
  ): Promise<OrderDetailResponse> {
    const computation = await this.resolveManualOrderComputation(currentUser, input);
    const orderId = this.generateUuid();
    const orderCode = await this.generateOrderCode(currentUser.storeId);

    await this.ordersRepository.withTransaction(async (db) => {
      await this.inventoryService.releaseExpiredReservationsInTransaction(db, currentUser.storeId);

      await this.ordersRepository.createOrder(db, {
        id: orderId,
        storeId: currentUser.storeId,
        customerId: computation.customer.id,
        orderCode,
        subtotal: computation.subtotal,
        total: computation.total,
        shippingZoneId: computation.shippingZoneId,
        shippingMethodId: computation.shippingMethodId,
        shippingMethodSnapshot: computation.shippingMethodSnapshot,
        shippingFee: computation.shippingFee,
        discountTotal: computation.discountTotal,
        couponCode: computation.couponCode,
        currencyCode: 'YER',
        exchangeRateYerPerUnit: 1,
        subtotalYER: computation.subtotal,
        totalYER: computation.total,
        shippingFeeYER: computation.shippingFee,
        discountTotalYER: computation.discountTotal,
        pointsDiscountAmountYER: 0,
        note: computation.note,
        shippingAddress: computation.shippingAddress,
      });

      await this.persistOrderItems(db, currentUser.storeId, orderId, computation.lines);
      if (computation.inventoryItems.length > 0) {
        await this.inventoryService.reserveOrderItems(db, {
          storeId: currentUser.storeId,
          orderId,
          expiresAt: this.buildReservationExpiryDate(),
          items: computation.inventoryItems,
          metadata: { source: 'admin.manual_order.create' },
        });
      }

      await this.ordersRepository.createPayment(db, {
        storeId: currentUser.storeId,
        orderId,
        method: computation.paymentMethod,
        amount: computation.total,
      });

      if (computation.couponId) {
        await this.promotionsService.increaseCouponUsageInTransaction(
          db,
          currentUser.storeId,
          computation.couponId,
        );
      }

      await this.ordersRepository.insertOrderStatusHistory(db, {
        storeId: currentUser.storeId,
        orderId,
        oldStatus: null,
        newStatus: 'new',
        changedBy: currentUser.id,
        note: 'Order created manually from admin panel',
      });
    });

    await this.auditService.log({
      action: 'orders.manual_created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'order',
      targetId: orderId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    await this.outboxService.enqueue({
      aggregateType: 'order',
      aggregateId: orderId,
      eventType: 'order.created',
      payload: {
        orderId,
        orderCode,
        storeId: currentUser.storeId,
        total: computation.total,
        currencyCode: 'YER',
        customerName: computation.customer.full_name,
        customerId: computation.customer.id,
        customerPhone: computation.customer.phone,
        paymentMethod: computation.paymentMethod,
        paymentStatus: 'pending',
        orderStatus: 'new',
        source: 'admin_manual',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });

    await this.webhooksService.dispatchEvent(currentUser.storeId, 'order.created', {
      orderId,
      orderCode,
      status: 'new',
      source: 'admin_manual',
    });

    return this.getById(currentUser, orderId);
  }

  async updateManual(
    currentUser: AuthUser,
    orderId: string,
    input: UpdateManualOrderDto,
    context: RequestContextData,
  ): Promise<OrderDetailResponse> {
    const order = await this.requireOrder(currentUser.storeId, orderId);
    if (!MANUAL_EDITABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Manual edits are allowed only before shipping');
    }

    const payment = await this.ordersRepository.findPaymentByOrderId(orderId);
    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === 'approved' || payment.status === 'refunded') {
      throw new BadRequestException('Order cannot be edited when payment is approved or refunded');
    }

    const existingItems = await this.ordersRepository.listOrderItems(orderId);
    const fallbackLines = existingItems.map((item) => ({
      variantId: item.variant_id,
      quantity: item.quantity,
      unitPriceOverride: Number(item.unit_price),
      lineDiscount: Math.max(Number(item.unit_price) * item.quantity - Number(item.line_total), 0),
    }));

    const shippingAddress = this.asObject(order.shipping_address);
    const resolvedCustomerName = input.customerName ?? this.readString(shippingAddress.fullName);
    const resolvedCustomerPhone = input.customerPhone ?? this.readString(shippingAddress.phone);
    const resolvedAddressLine = input.addressLine ?? this.readString(shippingAddress.addressLine);
    const resolvedCity =
      input.city !== undefined ? input.city : this.readNullableString(shippingAddress.city);
    const resolvedArea =
      input.area !== undefined ? input.area : this.readNullableString(shippingAddress.area);
    const updatePayload: {
      lines: Array<{
        variantId: string;
        quantity: number;
        unitPriceOverride?: number;
        lineDiscount?: number;
      }>;
      customerId: string;
      customerAddressId?: string;
      shippingZoneId?: string;
      shippingMethodId?: string;
      couponCode?: string;
      note?: string;
      paymentMethod: PaymentMethod;
      customerName?: string;
      customerPhone?: string;
      addressLine?: string;
      city?: string | null;
      area?: string | null;
    } = {
      lines: input.lines ?? fallbackLines,
      customerId: input.customerId ?? order.customer_id ?? '',
      paymentMethod: input.paymentMethod ?? (payment.method as PaymentMethod),
      ...(input.customerAddressId ? { customerAddressId: input.customerAddressId } : {}),
      ...(input.shippingZoneId !== undefined
        ? input.shippingZoneId
          ? { shippingZoneId: input.shippingZoneId }
          : {}
        : order.shipping_zone_id
          ? { shippingZoneId: order.shipping_zone_id }
          : {}),
      ...(input.shippingMethodId !== undefined
        ? input.shippingMethodId
          ? { shippingMethodId: input.shippingMethodId }
          : {}
        : order.shipping_method_id
          ? { shippingMethodId: order.shipping_method_id }
          : {}),
      ...(input.couponCode !== undefined
        ? input.couponCode
          ? { couponCode: input.couponCode }
          : {}
        : order.coupon_code
          ? { couponCode: order.coupon_code }
          : {}),
      ...(input.note !== undefined ? { note: input.note } : order.note ? { note: order.note } : {}),
      ...(resolvedCustomerName !== undefined ? { customerName: resolvedCustomerName } : {}),
      ...(resolvedCustomerPhone !== undefined ? { customerPhone: resolvedCustomerPhone } : {}),
      ...(resolvedAddressLine !== undefined ? { addressLine: resolvedAddressLine } : {}),
      ...(resolvedCity !== undefined ? { city: resolvedCity } : {}),
      ...(resolvedArea !== undefined ? { area: resolvedArea } : {}),
    };
    const computation = await this.resolveManualOrderComputation(currentUser, updatePayload);

    const lowStockSignals: LowStockSignal[] = [];
    const backInStockSignals: BackInStockSignal[] = [];

    await this.ordersRepository.withTransaction(async (db) => {
      await this.inventoryService.releaseExpiredReservationsInTransaction(db, currentUser.storeId);

      if (order.status === 'new') {
        await this.inventoryService.releaseOrderReservations(db, {
          storeId: currentUser.storeId,
          orderId,
          reason: 'order_manual_updated',
        });
      } else {
        const restockSignals = await this.inventoryService.restockOrderSales(db, {
          storeId: currentUser.storeId,
          orderId,
          actorId: currentUser.id,
          note: 'Stock returned before manual order update',
          movementType: 'return',
        });
        backInStockSignals.push(...restockSignals);
      }

      await this.ordersRepository.updateOrderManual(db, {
        orderId,
        storeId: currentUser.storeId,
        customerId: computation.customer.id,
        subtotal: computation.subtotal,
        total: computation.total,
        shippingZoneId: computation.shippingZoneId,
        shippingMethodId: computation.shippingMethodId,
        shippingMethodSnapshot: computation.shippingMethodSnapshot,
        shippingFee: computation.shippingFee,
        discountTotal: computation.discountTotal,
        couponCode: computation.couponCode,
        note: computation.note,
        shippingAddress: computation.shippingAddress,
      });

      await this.ordersRepository.deleteOrderItems(db, { storeId: currentUser.storeId, orderId });
      await this.persistOrderItems(db, currentUser.storeId, orderId, computation.lines);

      if (computation.inventoryItems.length > 0) {
        await this.inventoryService.reserveOrderItems(db, {
          storeId: currentUser.storeId,
          orderId,
          expiresAt: this.buildReservationExpiryDate(),
          items: computation.inventoryItems,
          metadata: { source: 'admin.manual_order.update' },
        });
      }

      if (order.status !== 'new' && computation.inventoryItems.length > 0) {
        const confirmSignals = await this.inventoryService.confirmReservedOrderItems(db, {
          storeId: currentUser.storeId,
          orderId,
          items: computation.inventoryItems,
          actorId: currentUser.id,
        });
        lowStockSignals.push(...confirmSignals);
      }

      if (EDITABLE_PAYMENT_STATUSES.includes(payment.status as PaymentStatus)) {
        await this.ordersRepository.updateOrderPayment(db, {
          storeId: currentUser.storeId,
          orderId,
          method: computation.paymentMethod,
          amount: computation.total,
        });
      }

      if (
        computation.couponId &&
        computation.couponCode &&
        computation.couponCode !== (order.coupon_code ?? null)
      ) {
        await this.promotionsService.increaseCouponUsageInTransaction(
          db,
          currentUser.storeId,
          computation.couponId,
        );
      }
    });

    await this.inventoryService.publishLowStockAlerts(lowStockSignals);
    await this.inventoryService.publishBackInStockAlerts(backInStockSignals);

    await this.auditService.log({
      action: 'orders.manual_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'order',
      targetId: orderId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        fromStatus: order.status,
        requestId: context.requestId,
      },
    });

    await this.outboxService.enqueue({
      aggregateType: 'order',
      aggregateId: orderId,
      eventType: 'order.updated',
      payload: {
        orderId,
        orderCode: order.order_code,
        storeId: currentUser.storeId,
        total: computation.total,
        currencyCode: order.currency_code,
        customerName: computation.customer.full_name,
        customerId: computation.customer.id,
        customerPhone: computation.customer.phone,
        paymentMethod: computation.paymentMethod,
        paymentStatus: payment.status,
        orderStatus: order.status,
        source: 'admin_manual',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });

    await this.webhooksService.dispatchEvent(currentUser.storeId, 'order.updated', {
      orderId,
      orderCode: order.order_code,
      status: order.status,
      source: 'admin_manual',
    });

    return this.getById(currentUser, orderId);
  }

  async getById(currentUser: AuthUser, orderId: string): Promise<OrderDetailResponse> {
    const order = await this.requireOrder(currentUser.storeId, orderId);
    const [items, timeline, payment, listRow] = await Promise.all([
      this.ordersRepository.listOrderItems(orderId),
      this.ordersRepository.listOrderStatusHistory(orderId),
      this.ordersRepository.findPaymentByOrderId(orderId),
      this.ordersRepository.findOrderListRowById(currentUser.storeId, orderId),
    ]);
    const mappedOrder = listRow ? this.mapListOrder(listRow) : this.mapOrder(order);

    return {
      ...mappedOrder,
      items: items.map((item) => this.mapOrderItem(item)),
      timeline: timeline.map((entry) => this.mapOrderHistory(entry)),
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            amount: Number(payment.amount),
            receiptUrl: payment.receipt_url,
            paymentMethodCode: payment.payment_method_code,
            paymentMethodName: payment.payment_method_name,
            accountName: payment.account_name,
            accountNumber: payment.account_number,
            phoneNumber: payment.phone_number,
            iban: payment.iban,
            instructionsAr: payment.instructions_ar,
            instructionsEn: payment.instructions_en,
            payerReference: payment.payer_reference,
            payerReceiptUrl: payment.payer_receipt_url,
            payerReceiptMediaAssetId: payment.payer_receipt_media_asset_id,
            payerNote: payment.payer_note,
            customerSubmittedAt: payment.customer_submitted_at,
            reviewedBy: payment.reviewed_by,
            reviewedAt: payment.reviewed_at,
            reviewNote: payment.review_note,
          }
        : null,
    };
  }

  async updateStatus(
    currentUser: AuthUser,
    orderId: string,
    input: UpdateOrderStatusDto,
    context: RequestContextData,
  ): Promise<OrderDetailResponse> {
    const order = await this.requireOrder(currentUser.storeId, orderId);
    this.ensureTransitionAllowed(order.status, input.status);

    const lowStockSignals: LowStockSignal[] = [];
    const backInStockSignals: BackInStockSignal[] = [];
    let loyaltyCustomerId: string | null = null;

    await this.ordersRepository.withTransaction(async (db) => {
      await this.inventoryService.releaseExpiredReservationsInTransaction(db, currentUser.storeId);
      const transitionSignals = await this.applyInventoryTransition(db, {
        orderId,
        currentStatus: order.status,
        nextStatus: input.status,
        storeId: currentUser.storeId,
        actorId: currentUser.id,
      });
      lowStockSignals.push(...transitionSignals.lowStockSignals);
      backInStockSignals.push(...transitionSignals.backInStockSignals);

      await this.ordersRepository.updateOrderStatus(db, {
        orderId,
        storeId: currentUser.storeId,
        nextStatus: input.status,
      });

      await this.ordersRepository.insertOrderStatusHistory(db, {
        storeId: currentUser.storeId,
        orderId,
        oldStatus: order.status,
        newStatus: input.status,
        changedBy: currentUser.id,
        note: input.note?.trim() ?? null,
      });

      if (input.status === 'completed') {
        await this.loyaltyService.handleOrderCompletedInTransaction(db, {
          storeId: currentUser.storeId,
          orderId,
          createdByStoreUserId: currentUser.id,
        });
      }

      if (input.status === 'cancelled' || input.status === 'returned') {
        await this.loyaltyService.handleOrderCancelledOrReturnedInTransaction(db, {
          storeId: currentUser.storeId,
          orderId,
          createdByStoreUserId: currentUser.id,
        });
      }
      await this.affiliatesService.handleOrderStatusChangedInTransaction(db, {
        storeId: currentUser.storeId,
        orderId,
        nextStatus: input.status,
      });

      const refreshedOrder = await this.ordersRepository.findOrderById(
        currentUser.storeId,
        orderId,
      );
      loyaltyCustomerId = refreshedOrder?.customer_id ?? null;
    });

    await this.inventoryService.publishLowStockAlerts(lowStockSignals);
    await this.inventoryService.publishBackInStockAlerts(backInStockSignals);
    await this.logAndPublishStatusChange(currentUser, order, input.status, input.note, context);
    await this.webhooksService.dispatchEvent(currentUser.storeId, 'order.updated', {
      orderId,
      orderCode: order.order_code,
      previousStatus: order.status,
      status: input.status,
      note: input.note?.trim() ?? null,
    });
    if (loyaltyCustomerId) {
      await this.loyaltyService.publishWalletUpdated(currentUser.storeId, loyaltyCustomerId);
    }
    return this.getById(currentUser, orderId);
  }

  private normalizeListFilters(
    storeId: string,
    query: Pick<
      ListOrdersQueryDto,
      'status' | 'q' | 'paymentMethod' | 'paymentStatus' | 'dateFrom' | 'dateTo'
    >,
  ): {
    storeId: string;
    status?: OrderStatus;
    q?: string;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  } {
    const dateFrom = query.dateFrom ? this.parseDate(query.dateFrom, 'dateFrom') : undefined;
    const dateTo = query.dateTo ? this.parseDate(query.dateTo, 'dateTo') : undefined;
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom cannot be after dateTo');
    }

    const normalized: {
      storeId: string;
      status?: OrderStatus;
      q?: string;
      paymentMethod?: PaymentMethod;
      paymentStatus?: PaymentStatus;
      dateFrom?: Date;
      dateTo?: Date;
    } = {
      storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as PaymentStatus } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    };
    return normalized;
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }

  private mapStatusCounts(
    rows: Array<{ status: OrderStatus; count: string }>,
  ): Record<OrderStatus, number> {
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  private async requireOrder(storeId: string, orderId: string): Promise<OrderRecord> {
    const order = await this.ordersRepository.findOrderById(storeId, orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private ensureTransitionAllowed(current: OrderStatus, next: OrderStatus): void {
    if (current === next) {
      throw new BadRequestException('Order is already in the requested status');
    }

    if (!canTransitionOrderStatus(current, next)) {
      throw new BadRequestException(`Order cannot transition from ${current} to ${next}`);
    }
  }

  private async applyInventoryTransition(
    db: Queryable,
    input: {
      orderId: string;
      currentStatus: OrderStatus;
      nextStatus: OrderStatus;
      storeId: string;
      actorId: string | null;
    },
  ): Promise<{ lowStockSignals: LowStockSignal[]; backInStockSignals: BackInStockSignal[] }> {
    if (input.currentStatus === 'new' && input.nextStatus === 'confirmed') {
      const lowStockSignals = await this.inventoryService.confirmOrderReservations(db, {
        storeId: input.storeId,
        orderId: input.orderId,
        actorId: input.actorId,
        expiresAt: this.buildReservationExpiryDate(),
      });
      return { lowStockSignals, backInStockSignals: [] };
    }

    if (input.currentStatus === 'new' && input.nextStatus === 'cancelled') {
      await this.releaseOrderReservations(db, input.storeId, input.orderId);
      return { lowStockSignals: [], backInStockSignals: [] };
    }

    if (this.isCancellationAfterStockDeduction(input.currentStatus, input.nextStatus)) {
      const backInStockSignals = await this.restockCancelledOrder(db, input);
      return { lowStockSignals: [], backInStockSignals };
    }

    if (
      (input.currentStatus === 'out_for_delivery' || input.currentStatus === 'completed') &&
      input.nextStatus === 'returned'
    ) {
      const backInStockSignals = await this.restockReturnedOrder(db, input);
      return { lowStockSignals: [], backInStockSignals };
    }

    return { lowStockSignals: [], backInStockSignals: [] };
  }

  private isCancellationAfterStockDeduction(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): boolean {
    return (
      nextStatus === 'cancelled' &&
      (currentStatus === 'confirmed' ||
        currentStatus === 'preparing' ||
        currentStatus === 'out_for_delivery')
    );
  }

  private async releaseOrderReservations(
    db: Queryable,
    storeId: string,
    orderId: string,
  ): Promise<void> {
    await this.inventoryService.releaseOrderReservations(db, {
      storeId,
      orderId,
      reason: 'order_cancelled',
    });
  }

  private async restockCancelledOrder(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      actorId: string | null;
    },
  ): Promise<BackInStockSignal[]> {
    return this.inventoryService.restockOrderSales(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      actorId: input.actorId,
      note: 'Stock returned after order cancellation',
      movementType: 'return',
    });
  }

  private async restockReturnedOrder(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      actorId: string | null;
    },
  ): Promise<BackInStockSignal[]> {
    return this.inventoryService.restockOrderSales(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      actorId: input.actorId,
      note: 'Stock returned from delivered order',
      movementType: 'return',
    });
  }

  private async resolveManualOrderComputation(
    currentUser: AuthUser,
    input: {
      lines: Array<{
        variantId: string;
        quantity: number;
        unitPriceOverride?: number;
        lineDiscount?: number;
      }>;
      customerId: string;
      customerAddressId?: string;
      shippingZoneId?: string;
      shippingMethodId?: string;
      couponCode?: string;
      note?: string;
      paymentMethod: PaymentMethod;
      customerName?: string;
      customerPhone?: string;
      addressLine?: string;
      city?: string | null;
      area?: string | null;
    },
  ): Promise<ManualOrderComputation> {
    if (!input.customerId) {
      throw new BadRequestException('customerId is required');
    }

    const customer = await this.ordersRepository.findCustomerById(
      currentUser.storeId,
      input.customerId,
    );
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const lines = await this.resolveManualLines(currentUser.storeId, input.lines);
    if (lines.length === 0) {
      throw new BadRequestException('At least one order line is required');
    }

    const subtotal = Number(
      lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0).toFixed(2),
    );
    const lineDiscountTotal = Number(
      lines.reduce((sum, line) => sum + line.lineDiscount, 0).toFixed(2),
    );

    const normalizedCouponCode = input.couponCode?.trim();
    let couponCode: string | null = null;
    let couponId: string | null = null;
    let couponDiscount = 0;
    let couponIsFreeShipping = false;

    if (normalizedCouponCode) {
      const coupon = await this.promotionsService.applyCoupon(currentUser, {
        code: normalizedCouponCode,
        subtotal: subtotal - lineDiscountTotal,
      });
      couponCode = coupon.code;
      couponId = coupon.couponId;
      couponDiscount = coupon.discount;
      couponIsFreeShipping = coupon.isFreeShipping;
    }

    const shippingZone = input.shippingZoneId
      ? await this.shippingRepository.findActiveById(currentUser.storeId, input.shippingZoneId)
      : null;
    if (input.shippingZoneId && !shippingZone) {
      throw new BadRequestException('Shipping zone not found or inactive');
    }

    const selectedShipping = shippingZone
      ? this.shippingCalculatorService.resolveMethod({
          zone: shippingZone,
          methods: await this.shippingRepository.listMethodsByZone(
            currentUser.storeId,
            shippingZone.id,
            true,
          ),
          items: lines.map((line) => ({
            quantity: line.quantity,
            productWeight: line.productWeight,
          })),
          subtotal: subtotal - lineDiscountTotal,
          couponCode,
          couponIsFreeShipping,
          requestedMethodId: input.shippingMethodId ?? null,
          autoSelectStrategy: 'free_then_first',
        }).selectedMethod
      : null;

    if (shippingZone && !selectedShipping) {
      throw new BadRequestException('No applicable shipping methods for selected zone');
    }

    const shippingFee = selectedShipping?.cost ?? 0;
    const discountTotal = Number((lineDiscountTotal + couponDiscount).toFixed(2));
    const total = Number((subtotal + shippingFee - discountTotal).toFixed(2));
    if (total < 0) {
      throw new BadRequestException('Computed order total cannot be negative');
    }

    const shippingInput: {
      customerAddressId?: string;
      customerName?: string;
      customerPhone?: string;
      addressLine?: string;
      city?: string | null;
      area?: string | null;
      note?: string;
    } = {
      ...(input.customerAddressId ? { customerAddressId: input.customerAddressId } : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
      ...(input.addressLine ? { addressLine: input.addressLine } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
      ...(input.note ? { note: input.note } : {}),
    };
    const shippingAddress = await this.resolveShippingAddress(
      currentUser.storeId,
      customer,
      shippingInput,
      selectedShipping?.type !== 'store_pickup',
    );

    return {
      customer,
      shippingAddress,
      shippingZoneId: shippingZone?.id ?? null,
      shippingMethodId: selectedShipping?.id?.startsWith('legacy-')
        ? null
        : (selectedShipping?.id ?? null),
      shippingMethodSnapshot: selectedShipping
        ? {
            type: selectedShipping.type,
            displayName: selectedShipping.displayName,
            description: selectedShipping.description,
            cost: selectedShipping.cost,
            minDeliveryDays: selectedShipping.minDeliveryDays,
            maxDeliveryDays: selectedShipping.maxDeliveryDays,
          }
        : null,
      shippingMethodType: selectedShipping?.type ?? null,
      shippingFee,
      couponCode,
      couponId,
      lines,
      inventoryItems: this.buildInventoryItems(lines),
      subtotal,
      discountTotal,
      total,
      note: input.note?.trim() ?? null,
      paymentMethod: input.paymentMethod,
    };
  }

  private async resolveManualLines(
    storeId: string,
    inputLines: Array<{
      variantId: string;
      quantity: number;
      unitPriceOverride?: number;
      lineDiscount?: number;
    }>,
  ): Promise<ManualResolvedLine[]> {
    if (!Array.isArray(inputLines) || inputLines.length === 0) {
      return [];
    }

    const mergedByVariant = new Map<
      string,
      { quantity: number; unitPriceOverride?: number; lineDiscount: number }
    >();

    for (const line of inputLines) {
      if (line.quantity < 1) {
        throw new BadRequestException('Line quantity must be at least 1');
      }

      const existing = mergedByVariant.get(line.variantId);
      if (existing) {
        existing.quantity += line.quantity;
        if (line.unitPriceOverride !== undefined) {
          existing.unitPriceOverride = line.unitPriceOverride;
        }
        existing.lineDiscount = Number(
          (existing.lineDiscount + (line.lineDiscount ?? 0)).toFixed(2),
        );
      } else {
        mergedByVariant.set(line.variantId, {
          quantity: line.quantity,
          ...(line.unitPriceOverride !== undefined
            ? { unitPriceOverride: line.unitPriceOverride }
            : {}),
          lineDiscount: line.lineDiscount ?? 0,
        });
      }
    }

    const resolved: ManualResolvedLine[] = [];
    for (const [variantId, merged] of mergedByVariant.entries()) {
      const variant = await this.requireManualVariant(storeId, variantId);
      const unitPrice = merged.unitPriceOverride ?? Number(variant.price);
      if (unitPrice < 0) {
        throw new BadRequestException('Unit price cannot be negative');
      }

      const maxDiscount = unitPrice * merged.quantity;
      if (merged.lineDiscount < 0 || merged.lineDiscount > maxDiscount) {
        throw new BadRequestException(`Invalid lineDiscount for SKU ${variant.sku}`);
      }

      const lineTotal = Number((unitPrice * merged.quantity - merged.lineDiscount).toFixed(2));
      resolved.push({
        productId: variant.product_id,
        variantId: variant.variant_id,
        title: this.resolveVariantTitle(variant),
        sku: variant.sku,
        unitPrice: Number(unitPrice.toFixed(2)),
        quantity: merged.quantity,
        lineDiscount: Number(merged.lineDiscount.toFixed(2)),
        lineTotal,
        attributes: variant.attributes ?? {},
        stockUnlimited: variant.stock_unlimited,
        productWeight: variant.product_weight !== null ? Number(variant.product_weight) : null,
      });
    }

    return resolved;
  }

  private async requireManualVariant(
    storeId: string,
    variantId: string,
  ): Promise<StoreVariantSnapshot> {
    const variant = await this.ordersRepository.findVariantForStore(storeId, variantId);
    if (!variant || variant.product_status !== 'active' || !variant.product_is_visible) {
      throw new NotFoundException('Variant not found or inactive');
    }

    if (variant.product_type === 'bundled') {
      throw new BadRequestException('Bundled variants are not supported in manual order flow');
    }

    return variant;
  }

  private async resolveShippingAddress(
    storeId: string,
    customer: CustomerSummaryRow,
    input: {
      customerAddressId?: string;
      customerName?: string;
      customerPhone?: string;
      addressLine?: string;
      city?: string | null;
      area?: string | null;
      note?: string;
    },
    requireAddressLine = true,
  ): Promise<Record<string, unknown>> {
    let selectedAddress: CustomerAddressSummaryRow | null = null;
    if (input.customerAddressId) {
      selectedAddress = await this.ordersRepository.findCustomerAddressById(
        storeId,
        customer.id,
        input.customerAddressId,
      );
      if (!selectedAddress) {
        throw new BadRequestException('Customer address not found');
      }
    }

    const addressLine = selectedAddress?.address_line ?? input.addressLine?.trim();
    if (requireAddressLine && !addressLine) {
      throw new BadRequestException('addressLine is required for manual orders');
    }

    return {
      fullName: input.customerName?.trim() || customer.full_name,
      phone: input.customerPhone?.trim() || customer.phone,
      addressLine: addressLine ?? null,
      city: selectedAddress?.city ?? input.city?.trim() ?? null,
      area: selectedAddress?.area ?? input.area?.trim() ?? null,
      note: selectedAddress?.notes ?? input.note?.trim() ?? null,
    };
  }

  private buildInventoryItems(lines: ManualResolvedLine[]): InventoryOrderItemInput[] {
    const aggregate = new Map<string, InventoryOrderItemInput>();
    for (const line of lines) {
      if (line.stockUnlimited) {
        continue;
      }

      const existing = aggregate.get(line.variantId);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        aggregate.set(line.variantId, {
          variantId: line.variantId,
          quantity: line.quantity,
          sku: line.sku,
        });
      }
    }
    return [...aggregate.values()];
  }

  private async persistOrderItems(
    db: Queryable,
    storeId: string,
    orderId: string,
    lines: ManualResolvedLine[],
  ): Promise<void> {
    for (const line of lines) {
      await this.ordersRepository.insertOrderItem(db, {
        orderId,
        storeId,
        productId: line.productId,
        variantId: line.variantId,
        title: line.title,
        sku: line.sku,
        unitPrice: line.unitPrice,
        unitPriceYER: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        lineTotalYER: line.lineTotal,
        attributes: line.attributes,
      });
    }
  }

  private async logAndPublishStatusChange(
    currentUser: AuthUser,
    order: OrderRecord,
    nextStatus: OrderStatus,
    note: string | undefined,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action: 'orders.status_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'order',
      targetId: order.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        from: order.status,
        to: nextStatus,
        note: note ?? null,
        requestId: context.requestId,
      },
    });

    await this.outboxService.enqueue({
      aggregateType: 'order',
      aggregateId: order.id,
      eventType: 'order.status.changed',
      payload: {
        orderId: order.id,
        orderCode: order.order_code,
        from: order.status,
        to: nextStatus,
        storeId: currentUser.storeId,
        customerId: order.customer_id,
        total: Number(order.total),
        currencyCode: order.currency_code,
        orderStatus: nextStatus,
        source: 'admin_status_update',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private mapOrder(order: OrderRecord): OrderResponse {
    return {
      id: order.id,
      orderCode: order.order_code,
      status: order.status,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      currencyCode: order.currency_code,
      note: order.note,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: {
        id: null,
        name: null,
        phone: null,
      },
      paymentMethod: null,
      paymentMethodCode: null,
      paymentMethodName: null,
      paymentStatus: null,
    };
  }

  private mapListOrder(order: OrderListRow): OrderResponse {
    return {
      id: order.id,
      orderCode: order.order_code,
      status: order.status,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      currencyCode: order.currency_code,
      note: order.note,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: {
        id: order.customer_id,
        name: order.customer_name,
        phone: order.customer_phone,
      },
      paymentMethod: order.payment_method,
      paymentMethodCode: order.payment_method_code,
      paymentMethodName: order.payment_method_name,
      paymentStatus: order.payment_status,
    };
  }

  private mapOrderItem(item: OrderItemRecord) {
    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.title,
      sku: item.sku,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      lineTotal: Number(item.line_total),
    };
  }

  private mapOrderHistory(entry: OrderStatusHistoryRecord) {
    return {
      from: entry.old_status,
      to: entry.new_status,
      note: entry.note,
      createdAt: entry.created_at,
    };
  }

  private mapManualProduct(row: ManualProductSearchRow) {
    return {
      variantId: row.variant_id,
      productId: row.product_id,
      productTitle: row.product_title,
      variantTitle: row.variant_title,
      sku: row.sku,
      price: Number(row.price),
      stockUnlimited: row.stock_unlimited,
      stockQuantity: row.stock_quantity,
      reservedQuantity: row.reserved_quantity,
      availableQuantity: row.available_quantity,
    };
  }

  private buildReservationExpiryDate(referenceDate: Date = new Date()): Date {
    const ttlMinutes = this.getReservationTtlMinutes();
    return new Date(referenceDate.getTime() + ttlMinutes * 60_000);
  }

  private getReservationTtlMinutes(): number {
    const raw = Number(process.env.INVENTORY_RESERVATION_TTL_MINUTES ?? '15');
    if (!Number.isInteger(raw) || raw < 1 || raw > 120) {
      return 15;
    }
    return raw;
  }

  private async generateOrderCode(storeId: string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `KS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await this.ordersRepository.findOrderByCode(storeId, candidate);
      if (!existing) {
        return candidate;
      }
    }
    throw new BadRequestException('Failed to generate a unique order code');
  }

  private resolveVariantTitle(variant: StoreVariantSnapshot): string {
    const variantTitle = variant.variant_title?.trim();
    if (!variantTitle || variantTitle === 'Default') {
      return variant.product_title;
    }
    return `${variant.product_title} - ${variantTitle}`;
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }

  private readNullableString(value: unknown): string | null | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private generateUuid(): string {
    return uuidv4();
  }
}
