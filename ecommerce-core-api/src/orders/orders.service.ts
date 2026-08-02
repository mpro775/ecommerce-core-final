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
import { AffiliatesService } from '../affiliates/affiliates.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CurrencyService } from '../currency/currency.service';
import { ORDER_STATUSES, type OrderStatus } from './constants/order-status.constants';
import type { PaymentMethod } from './constants/payment.constants';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import type { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import type { ManualOrderProductSearchQueryDto } from './dto/manual-order-product-search-query.dto';
import type { OrdersExportQueryDto } from './dto/orders-export-query.dto';
import type { UpdateManualOrderDto } from './dto/update-manual-order.dto';
import type { OrderCommandDto } from './dto/order-command.dto';
import { OrderTransitionService } from './transitions/order-transition.service';
import { ORDER_TRANSITION_RULES } from './transitions/order-transition.rules';
import { FULFILLMENT_RULES } from './transitions/fulfillment-transition.rules';
import { PAYMENT_COMMAND_RULES } from '../payments/payment-transition.rules';
import { DocumentSequenceService } from '../commercial/document-sequence.service';
import { CommercialCommandIdempotencyService } from '../commercial/commercial-command-idempotency.service';
import { CommercialDomainException, requireCommercialPermission, requireReason } from '../commercial/commercial.errors';
import { allocateLargestRemainder } from '../commercial/money-allocation';
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

const MANUAL_EDITABLE_STATUSES: OrderStatus[] = ['new'];
const EDITABLE_PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'under_review', 'rejected'];

interface ManualResolvedLine {
  productId: string;
  variantId: string;
  categoryId: string | null;
  title: string;
  sku: string;
  catalogUnitPrice: number;
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
  couponDiscount: number;
  couponEligibleVariantIds: string[];
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
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  fulfillment: { type: string; status: string; statusLabel: string };
  totals: { subtotalAmount: string; discountAmount: string; shippingAmount: string;
    taxAmount: string; totalAmount: string; paidAmount: string; refundedAmount: string;
    refundableAmount: string; currency: string };
  version: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  };
  paymentSummary: { method: PaymentMethod | null; methodCode: string | null;
    methodName: string | null; status: PaymentStatus | null };
}

export interface OrderDetailResponse extends OrderResponse {
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    sku: string;
    unitPrice: string;
    quantity: number;
    lineSubtotal: string;
    discountAmount: string;
    lineTotal: string;
    currency: string;
  }>;
  timeline: Array<{
    from: string | null;
    to: string;
    note: string | null;
    createdAt: string;
  }>;
  fulfillmentHistory: Array<{ from:string|null;to:string;command:string;reason:string|null;
    actorType:string;createdAt:string }>;
  paymentHistory: Array<{ from:string|null;to:string;command:string;reason:string|null;
    actorType:string;createdAt:string }>;
  inventoryReservations: Array<{ id:string;variantId:string;quantity:number;status:string;
    reservedAt:string;expiresAt:string;releasedAt:string|null;consumedAt:string|null;
    releaseReason:string|null }>;
  auditTimeline: Array<{ action:string;actorType:string;before:Record<string,unknown>|null;
    after:Record<string,unknown>|null;metadata:Record<string,unknown>;createdAt:string }>;
  payment: {
    id: string;
    method: string;
    status: string;
    statusLabel: string;
    amount: string;
    paidAmount: string;
    refundedAmount: string;
    refundableAmount: string;
    currency: string;
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
    customerSubmittedAt: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
  allowedTransitions: {
    order: Array<{ command: string; toStatus: string; requiresReason: boolean }>;
    fulfillment: Array<{ command: string; toStatus: string; requiresReason: boolean }>;
    payment: Array<{ command: string; toStatus: string; requiresReason: boolean }>;
  };
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
    private readonly loyaltyService: LoyaltyService,
    private readonly affiliatesService: AffiliatesService,
    private readonly currencyService: CurrencyService,
    private readonly orderTransitions: OrderTransitionService,
    private readonly documentSequences: DocumentSequenceService,
    private readonly commercialIdempotency: CommercialCommandIdempotencyService,
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
      data: result.rows.map((order) => this.mapListOrder(order)),
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
      summary: { statusCounts: this.mapStatusCounts(counts) },
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
      data: result.rows.map((row) => this.mapManualProduct(row)),
      meta: { page, limit, total: result.total, totalPages: Math.ceil(result.total/limit) },
    };
  }

  async createManual(
    currentUser: AuthUser,
    input: CreateManualOrderDto,
    idempotencyKey: string,
    context: RequestContextData,
  ): Promise<OrderDetailResponse> {
    const orderId = this.generateUuid();
    const overrideRequested=input.lines.some((line)=>line.unitPriceOverride!==undefined||
      (line.lineDiscount??0)>0);
    if(overrideRequested){requireCommercialPermission(currentUser.permissions,'orders:manual-price-override');
      requireReason(input.priceOverrideReason);}
    const result=await this.ordersRepository.withTransaction(async (db) => {
      const claim=await this.commercialIdempotency.claim(db,{storeId:currentUser.storeId,
        operation:'admin.order.create',key:idempotencyKey,actorId:currentUser.id,payload:input});
      if(claim.kind==='replay')return {orderId:String(claim.responseBody.id),replayed:true};
      const resolvedCurrency = await this.currencyService.resolveStoreCurrencyInTransaction(
        db,currentUser.storeId,input.currencyCode);
      const computation = await this.resolveManualOrderComputation(currentUser, input, db);
      const orderCode=await this.documentSequences.allocate(db,{storeId:currentUser.storeId,documentType:'ORD'});
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
        fulfillmentType: computation.shippingMethodType === 'store_pickup'
          ? 'pickup'
          : computation.shippingMethodType
            ? 'delivery'
            : 'manual_coordination',
        shippingFee: computation.shippingFee,
        discountTotal: computation.discountTotal,
        couponCode: computation.couponCode,
        currencyCode: resolvedCurrency.currencyCode,
        exchangeRateYerPerUnit: resolvedCurrency.yerPerUnit,
        subtotalYER: computation.subtotal,
        totalYER: computation.total,
        shippingFeeYER: computation.shippingFee,
        discountTotalYER: computation.discountTotal,
        pointsDiscountAmountYER: 0,
        note: computation.note,
        shippingAddress: computation.shippingAddress,
      });

      await this.persistOrderItems(db, currentUser.storeId, orderId, computation.lines,
        computation.couponDiscount,computation.couponEligibleVariantIds,resolvedCurrency.currencyCode, {
          actorId: currentUser.id, reason: input.priceOverrideReason?.trim() ?? null,
        });
      if (computation.inventoryItems.length > 0) {
        await this.inventoryService.reserveOrderItems(db, {
          storeId: currentUser.storeId,
          orderId,
          expiresAt: this.buildReservationExpiryDate(),
          items: computation.inventoryItems,
          metadata: { source: 'admin.manual_order.create' },
          actorId: currentUser.id,
          actorType: 'admin',
        });
      }

      await this.ordersRepository.createPayment(db, {
        storeId: currentUser.storeId,
        orderId,
        method: computation.paymentMethod,
        amount: computation.total,
        currencyCode: resolvedCurrency.currencyCode,
      });

      if (computation.couponId) {
        await this.promotionsService.consumeCouponInTransaction(db,{storeId:currentUser.storeId,
          couponId:computation.couponId,orderId,customerId:computation.customer.id,
          discountAmount:computation.couponDiscount,currencyCode:resolvedCurrency.currencyCode,
          subtotal:computation.subtotal,productIds:computation.lines.map((line)=>line.productId),categoryIds:computation.lines.map((line)=>line.categoryId).filter((id)=>id!==null) as string[]});
      }

      await this.ordersRepository.insertOrderStatusHistory(db, {
        storeId: currentUser.storeId,
        orderId,
        fromStatus: null,
        toStatus: 'new',
        actorId: currentUser.id,
        actorType: 'admin',
        command: 'createManualOrder',
        reason: 'Order created manually from admin panel',
        requestId: context.requestId,
        idempotencyRecordId: claim.recordId,
        businessKey: `order:${orderId}:created`,
      });
      await this.auditService.log({action:'orders.manual_created',storeId:currentUser.storeId,
        storeUserId:currentUser.id,targetType:'order',targetId:orderId,ipAddress:context.ipAddress,
        userAgent:context.userAgent,beforeSnapshot:null,afterSnapshot:{status:'new'},
        metadata:{requestId:context.requestId,priceOverride:overrideRequested,
          priceOverrideReason:overrideRequested?input.priceOverrideReason?.trim():null}},db);
      await this.outboxService.enqueueInTransaction(db,{aggregateType:'order',aggregateId:orderId,
        eventType:'order.created',deduplicationKey:`order.created:${orderId}`,
        payload:{orderId,orderNumber:orderCode,storeId:currentUser.storeId,totalAmount:this.decimal(computation.total),
          currency:resolvedCurrency.currencyCode,customerId:computation.customer.id,
          paymentMethod:computation.paymentMethod,paymentStatus:'pending',orderStatus:'new',source:'admin_manual',
          actor:{id:currentUser.id,type:'admin'},requestId:context.requestId??null}});
      const response={id:orderId,orderNumber:orderCode};
      await this.commercialIdempotency.complete(db,{recordId:claim.recordId,orderId,responseBody:response});
      return {orderId,replayed:false};
    });
    return this.getById(currentUser,result.orderId);
  }

  async updateManual(
    currentUser: AuthUser,
    orderId: string,
    input: UpdateManualOrderDto,
    idempotencyKey: string,
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
    const lowStockSignals: LowStockSignal[] = [];
    const backInStockSignals: BackInStockSignal[] = [];

    const overrideRequested=(input.lines??[]).some((line)=>line.unitPriceOverride!==undefined||
      (line.lineDiscount??0)>0);
    if(overrideRequested){requireCommercialPermission(currentUser.permissions,'orders:manual-price-override');
      requireReason(input.priceOverrideReason);}
    await this.ordersRepository.withTransaction(async (db) => {
      const claim=await this.commercialIdempotency.claim(db,{storeId:currentUser.storeId,
        operation:'admin.order.edit',key:idempotencyKey,actorId:currentUser.id,
        payload:{orderId,...input}});
      if(claim.kind==='replay')return;
      const locked=await db.query<{status:string;fulfillment_status:string;version:string}>(
        `SELECT status,fulfillment_status,version::text FROM orders
         WHERE store_id=$1 AND id=$2 FOR UPDATE`,[currentUser.storeId,orderId]);
      const lockedOrder=locked.rows[0];
      if(!lockedOrder)throw new NotFoundException('Order not found');
      if(lockedOrder.status!=='new'||lockedOrder.fulfillment_status!=='unfulfilled')
        throw new CommercialDomainException('MANUAL_ORDER_EDIT_NOT_ALLOWED','Order is no longer editable');
      if(Number(lockedOrder.version)!==input.expectedVersion)
        throw new CommercialDomainException('ORDER_VERSION_CONFLICT','Order version does not match');
      const lockedPayment=await db.query<{status:string;version:string}>(
        'SELECT status,version::text FROM payments WHERE store_id=$1 AND order_id=$2 FOR UPDATE',
        [currentUser.storeId,orderId]);
      if(!lockedPayment.rows[0]||['approved','partially_refunded','refunded'].includes(lockedPayment.rows[0].status))
        throw new CommercialDomainException('MANUAL_ORDER_EDIT_NOT_ALLOWED','Payment state blocks editing');
      const consumed=await db.query('SELECT 1 FROM inventory_reservations WHERE store_id=$1 AND order_id=$2 AND status=$3 FOR UPDATE',
        [currentUser.storeId,orderId,'consumed']);
      if(consumed.rows[0])throw new CommercialDomainException('MANUAL_ORDER_EDIT_NOT_ALLOWED','Consumed inventory blocks editing');
      await db.query('SELECT id FROM coupon_usages WHERE store_id=$1 AND order_id=$2 FOR UPDATE',
        [currentUser.storeId,orderId]);
      await this.inventoryService.releaseExpiredReservationsInTransaction(db, currentUser.storeId);
      const computation = await this.resolveManualOrderComputation(currentUser, updatePayload, db);

      await this.inventoryService.releaseOrderReservations(db, {
          storeId: currentUser.storeId,
          orderId,
          reason: 'order_manual_updated',
          actorId: currentUser.id,
          actorType: 'admin',
        });

      const updated=await this.ordersRepository.updateOrderManual(db, {
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
        expectedVersion: input.expectedVersion,
      });
      if(!updated)throw new CommercialDomainException('ORDER_VERSION_CONFLICT','Order changed concurrently');

      await this.ordersRepository.deleteOrderItems(db, { storeId: currentUser.storeId, orderId });
      await this.persistOrderItems(db, currentUser.storeId, orderId, computation.lines,
        computation.couponDiscount,computation.couponEligibleVariantIds,order.currency_code, {
          actorId: currentUser.id, reason: input.priceOverrideReason?.trim() ?? null,
        });

      if (computation.inventoryItems.length > 0) {
        await this.inventoryService.reserveOrderItems(db, {
          storeId: currentUser.storeId,
          orderId,
          expiresAt: this.buildReservationExpiryDate(),
          items: computation.inventoryItems,
          metadata: { source: 'admin.manual_order.update' },
          actorId: currentUser.id,
          actorType: 'admin',
        });
      }

      if (EDITABLE_PAYMENT_STATUSES.includes(lockedPayment.rows[0].status as PaymentStatus)) {
        const paymentUpdated = await this.ordersRepository.updateOrderPayment(db, {
          storeId: currentUser.storeId,
          orderId,
          method: computation.paymentMethod,
          amount: computation.total,
          expectedStatus: lockedPayment.rows[0].status,
          expectedVersion: Number(lockedPayment.rows[0].version),
        });
        if (!paymentUpdated) throw new CommercialDomainException(
          'PAYMENT_TRANSITION_CONFLICT', 'Payment changed concurrently');
      }

      await this.promotionsService.reverseCouponInTransaction(db,{storeId:currentUser.storeId,
        orderId,reason:'manual_order_updated'});
      if(computation.couponId)await this.promotionsService.consumeCouponInTransaction(db,{
          storeId:currentUser.storeId,couponId:computation.couponId,orderId,
          customerId:computation.customer.id,discountAmount:computation.couponDiscount,
          currencyCode:order.currency_code,subtotal:computation.subtotal,
          productIds:computation.lines.map((line)=>line.productId),categoryIds:computation.lines.map((line)=>line.categoryId).filter((id)=>id!==null) as string[]});
      await this.ordersRepository.insertOrderStatusHistory(db, {
        storeId: currentUser.storeId, orderId, fromStatus: 'new', toStatus: 'new',
        actorId: currentUser.id, actorType: 'admin', command: 'editManualOrder',
        reason: 'Manual order commercial snapshot updated', requestId: context.requestId,
        idempotencyRecordId: claim.recordId,
        businessKey: `order:${orderId}:manual_edit:${input.expectedVersion}`,
      });
      await this.auditService.log({action:'orders.manual_updated',storeId:currentUser.storeId,
        storeUserId:currentUser.id,targetType:'order',targetId:orderId,
        ipAddress:context.ipAddress,userAgent:context.userAgent,
        beforeSnapshot:{version:input.expectedVersion},afterSnapshot:{version:input.expectedVersion+1},
        metadata:{requestId:context.requestId,priceOverride:overrideRequested,
          priceOverrideReason:overrideRequested?input.priceOverrideReason?.trim():null}},db);
      await this.outboxService.enqueueInTransaction(db,{aggregateType:'order',aggregateId:orderId,
        eventType:'order.updated',deduplicationKey:`order.updated:${orderId}:${input.expectedVersion+1}`,
        payload:{storeId:currentUser.storeId,orderId,orderNumber:order.order_code,
          totalAmount:this.decimal(computation.total),currency:order.currency_code,
          version:input.expectedVersion+1,actor:{id:currentUser.id,type:'admin'},
          requestId:context.requestId??null}});
      await this.commercialIdempotency.complete(db,{recordId:claim.recordId,orderId,
        responseBody:{id:orderId,version:input.expectedVersion+1}});
    });

    await this.inventoryService.publishLowStockAlerts(lowStockSignals);
    await this.inventoryService.publishBackInStockAlerts(backInStockSignals);

    return this.getById(currentUser, orderId);
  }

  async getById(currentUser: AuthUser, orderId: string): Promise<OrderDetailResponse> {
    const order = await this.requireOrder(currentUser.storeId, orderId);
    const [items, timeline, payment, listRow, evidence] = await Promise.all([
      this.ordersRepository.listOrderItems(orderId),
      this.ordersRepository.listOrderStatusHistory(orderId),
      this.ordersRepository.findPaymentByOrderId(orderId),
      this.ordersRepository.findOrderListRowById(currentUser.storeId, orderId),
      this.ordersRepository.listCommercialDetailEvidence(currentUser.storeId, orderId),
    ]);
    const mappedOrder = listRow ? this.mapListOrder(listRow) : this.mapOrder(order);

    return {
      ...mappedOrder,
      items: items.map((item) => this.mapOrderItem(item)),
      timeline: timeline.map((entry) => this.mapOrderHistory(entry)),
      fulfillmentHistory: evidence.fulfillment.map((entry)=>({from:entry.from_status,to:entry.to_status,
        command:entry.command,reason:entry.reason,actorType:entry.actor_type,
        createdAt:entry.created_at.toISOString()})),
      paymentHistory: evidence.payment.map((entry)=>({from:entry.from_status,to:entry.to_status,
        command:entry.command,reason:entry.reason,actorType:entry.actor_type,
        createdAt:entry.created_at.toISOString()})),
      inventoryReservations: evidence.reservations.map((entry)=>({id:entry.id,variantId:entry.variant_id,
        quantity:entry.quantity,status:entry.status,reservedAt:entry.reserved_at.toISOString(),
        expiresAt:entry.expires_at.toISOString(),releasedAt:entry.released_at?.toISOString()??null,
        consumedAt:entry.consumed_at?.toISOString()??null,releaseReason:entry.release_reason})),
      auditTimeline: evidence.audit.map((entry)=>({action:entry.action,actorType:entry.actor_type,
        before:entry.before_snapshot,after:entry.after_snapshot,metadata:entry.metadata,
        createdAt:entry.created_at.toISOString()})),
      payment: payment
        ? {
            id: payment.id,
            method: payment.method,
            status: payment.status,
            statusLabel: this.statusLabel(payment.status),
            amount: payment.amount,
            paidAmount: payment.paid_amount,
            refundedAmount: payment.refunded_amount,
            refundableAmount: this.decimal(Math.max(0, Number(payment.paid_amount)-Number(payment.refunded_amount))),
            currency: payment.currency_code,
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
            customerSubmittedAt: payment.customer_submitted_at?.toISOString() ?? null,
            reviewedBy: payment.reviewed_by,
            reviewedAt: payment.reviewed_at?.toISOString() ?? null,
            reviewNote: payment.review_note,
          }
        : null,
      allowedTransitions: this.allowedTransitions(currentUser, order, payment),
    };
  }

  confirmOrder(currentUser: AuthUser, orderId: string, input: OrderCommandDto, idempotencyKey: string,
    context: RequestContextData) {
    return this.orderTransitions.confirmOrder(this.commandInput(currentUser, orderId, input, idempotencyKey, context));
  }

  cancelOrder(currentUser: AuthUser, orderId: string, input: OrderCommandDto, idempotencyKey: string,
    context: RequestContextData) {
    return this.orderTransitions.cancelOrder(this.commandInput(currentUser, orderId, input, idempotencyKey, context));
  }

  completeOrder(currentUser: AuthUser, orderId: string, input: OrderCommandDto, idempotencyKey: string,
    context: RequestContextData) {
    return this.orderTransitions.completeOrder(this.commandInput(currentUser, orderId, input, idempotencyKey, context));
  }

  private commandInput(currentUser: AuthUser, orderId: string, input: OrderCommandDto,
    idempotencyKey: string, context: RequestContextData) {
    return {
      storeId: currentUser.storeId,
      orderId,
      idempotencyKey,
      reason: input.reason,
      expectedVersion: input.expectedVersion,
      actor: { id: currentUser.id, type: 'admin' as const, permissions: currentUser.permissions },
      context,
    };
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
    db?: Queryable,
  ): Promise<ManualOrderComputation> {
    if (!input.customerId) {
      throw new BadRequestException('customerId is required');
    }

    const customer = await this.ordersRepository.findCustomerById(
      currentUser.storeId,
      input.customerId,
      db,
    );
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const lines = await this.resolveManualLines(currentUser.storeId, input.lines, db);
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
    let couponEligibleVariantIds: string[] = [];

    if (normalizedCouponCode) {
      const coupon = await this.promotionsService.computeManualOrderCouponDiscount(
        currentUser.storeId,
        normalizedCouponCode,
        lines,
        new Date(),
        db,
      );
      couponCode = coupon.couponCode;
      couponId = coupon.couponId;
      couponDiscount = coupon.couponDiscount;
      couponIsFreeShipping = coupon.couponIsFreeShipping;
      couponEligibleVariantIds = coupon.couponEligibleVariantIds;
    }

    const shippingZone = input.shippingZoneId
      ? await this.shippingRepository.findActiveById(currentUser.storeId, input.shippingZoneId, db)
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
            db,
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
      db,
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
      couponDiscount,
      couponEligibleVariantIds,
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
    db?: Queryable,
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
      const variant = await this.requireManualVariant(storeId, variantId, db);
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
        categoryId: variant.category_id,
        title: this.resolveVariantTitle(variant),
        sku: variant.sku,
        catalogUnitPrice: Number(Number(variant.price).toFixed(2)),
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
    db?: Queryable,
  ): Promise<StoreVariantSnapshot> {
    const variant = await this.ordersRepository.findVariantForStore(storeId, variantId, db);
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
    db?: Queryable,
  ): Promise<Record<string, unknown>> {
    let selectedAddress: CustomerAddressSummaryRow | null = null;
    if (input.customerAddressId) {
      selectedAddress = await this.ordersRepository.findCustomerAddressById(
        storeId,
        customer.id,
        input.customerAddressId,
        db,
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
    couponDiscount: number,
    couponEligibleVariantIds: string[],
    currencyCode: string,
    overrideAudit: { actorId: string; reason: string | null },
  ): Promise<void> {
    const snapshotAt = new Date().toISOString();
    const couponAllocation=allocateLargestRemainder(lines.filter(l => couponEligibleVariantIds.includes(l.variantId)).map((line)=>({key:line.variantId,
      amount:Number((line.unitPrice*line.quantity-line.lineDiscount).toFixed(2))})),couponDiscount);
    for (const line of lines) {
      const lineSubtotal=Number((line.unitPrice*line.quantity).toFixed(2));
      const lineDiscount=Number((line.lineDiscount+(couponAllocation.get(line.variantId)??0)).toFixed(2));
      const lineTotal=Number((lineSubtotal-lineDiscount).toFixed(2));
      await this.ordersRepository.insertOrderItem(db, {
        orderId,
        storeId,
        productId: line.productId,
        variantId: line.variantId,
        title: line.title,
        variantName: '',
        sku: line.sku,
        unitPrice: line.unitPrice,
        unitPriceYER: line.unitPrice,
        quantity: line.quantity,
        lineTotal,
        lineTotalYER: lineTotal,
        attributes: {
          ...line.attributes,
          _catalogUnitPrice: line.catalogUnitPrice.toFixed(2),
          _manualUnitPrice: line.unitPrice.toFixed(2),
          _manualPriceOverridden: String(line.catalogUnitPrice !== line.unitPrice || line.lineDiscount > 0),
          _manualPriceOverrideActorId: overrideAudit.actorId,
          _manualPriceOverrideReason: overrideAudit.reason ?? '',
          _manualPriceSnapshotAt: snapshotAt,
        },
        currencyCode,
        productImage: null,
        discountAmount: lineDiscount,
        finalUnitPrice: Number((lineTotal/line.quantity).toFixed(2)),
        lineSubtotal,
        lineDiscount,
        taxSnapshot: {
          policy: 'not_configured',
          taxable: false,
          rate: '0.00',
          amount: '0.00',
          includedInPrice: true,
        },
      });
    }
  }

  private mapOrder(order: OrderRecord): OrderResponse {
    return {
      id: order.id,
      orderNumber: order.order_code,
      status: order.status,
      statusLabel: this.statusLabel(order.status),
      fulfillment: { type: order.fulfillment_type, status: order.fulfillment_status,
        statusLabel: this.statusLabel(order.fulfillment_status) },
      totals: this.orderTotals(order),
      version: Number(order.version),
      note: order.note,
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString(),
      customer: {
        id: null,
        name: null,
        phone: null,
      },
      paymentSummary: { method: null, methodCode: null, methodName: null, status: null },
    };
  }

  private mapListOrder(order: OrderListRow): OrderResponse {
    return {
      id: order.id,
      orderNumber: order.order_code,
      status: order.status,
      statusLabel: this.statusLabel(order.status),
      fulfillment: { type: order.fulfillment_type, status: order.fulfillment_status,
        statusLabel: this.statusLabel(order.fulfillment_status) },
      totals: this.orderTotals(order),
      version: Number(order.version),
      note: order.note,
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString(),
      customer: {
        id: order.customer_id,
        name: order.customer_name,
        phone: order.customer_phone,
      },
      paymentSummary: { method: order.payment_method, methodCode: order.payment_method_code,
        methodName: order.payment_method_name, status: order.payment_status },
    };
  }

  private mapOrderItem(item: OrderItemRecord) {
    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.title,
      productName: item.product_name,
      variantName: item.variant_name,
      sku: item.sku,
      unitPrice: item.unit_price,
      finalUnitPrice: item.final_unit_price,
      discountAmount: item.discount_amount,
      currency: item.currency_code,
      productImage: item.product_image,
      attributes: item.attributes_snapshot,
      tax: item.tax_snapshot,
      quantity: item.quantity,
      lineSubtotal: item.line_subtotal,
      lineDiscount: item.line_discount,
      lineTotal: item.line_total,
    };
  }

  private mapOrderHistory(entry: OrderStatusHistoryRecord) {
    return {
      from: entry.from_status,
      to: entry.to_status,
      note: entry.reason,
      createdAt: entry.created_at.toISOString(),
    };
  }

  private orderTotals(order: OrderRecord) {
    return { subtotalAmount: order.subtotal, discountAmount: order.discount_total,
      shippingAmount: order.shipping_fee, taxAmount: order.tax_amount, totalAmount: order.total,
      paidAmount: order.paid_amount, refundedAmount: order.refunded_amount,
      refundableAmount: this.decimal(Math.max(0,Number(order.paid_amount)-Number(order.refunded_amount))),
      currency: order.currency_code };
  }

  private decimal(value:number):string { return value.toFixed(2); }
  private statusLabel(status:string):string {
    return ({new:'New',confirmed:'Confirmed',completed:'Completed',cancelled:'Cancelled',
      unfulfilled:'Unfulfilled',preparing:'Preparing',ready:'Ready',out_for_delivery:'Out for delivery',
      fulfilled:'Fulfilled',failed:'Failed',pending:'Pending',submitted:'Submitted',
      under_review:'Under review',approved:'Approved',rejected:'Rejected',expired:'Expired',
      partially_refunded:'Partially refunded',refunded:'Refunded'} as Record<string,string>)[status]??status;
  }

  private allowedTransitions(
    user:AuthUser,
    order:OrderRecord,
    payment:{status:string;method:string;payment_method_code:string|null;paid_amount:string;amount:string;
      expires_at:Date|null}|null,
  ) {
    const has=(permission:string)=>user.permissions.includes('*')||user.permissions.includes(permission);
    const orderTransitions=Object.entries(ORDER_TRANSITION_RULES).filter(([,rule])=>
      rule.from===order.status&&has(rule.permission)&&
      (rule.to!=='cancelled'||(order.fulfillment_status!=='fulfilled'&&
        !['approved','partially_refunded','refunded'].includes(payment?.status??'')))&&
      (rule.to!=='completed'||(order.fulfillment_status==='fulfilled'&&payment?.status==='approved'&&
        Number(payment.paid_amount)>0&&Number(payment.paid_amount)===Number(payment.amount))))
      .map(([command,rule])=>({command,toStatus:rule.to,
        requiresReason:rule.requiresReason}));
    if(order.status==='confirmed'&&has('orders:cancel')&&order.fulfillment_status!=='fulfilled'&&
      !['approved','partially_refunded','refunded'].includes(payment?.status??''))orderTransitions.push({command:'cancelOrder',
      toStatus:'cancelled',requiresReason:true});
    const paymentMethod=payment?.payment_method_code??payment?.method??null;
    const paymentGate=paymentMethod==='cod'?['pending','approved'].includes(payment?.status??''):
      payment?.status==='approved';
    const fulfillment=Object.entries(FULFILLMENT_RULES).filter(([command,rule])=>order.status==='confirmed'&&
      rule.from.includes(order.fulfillment_status)&&rule.types.includes(order.fulfillment_type)&&has(rule.permission)&&
      (!rule.paymentGate||paymentGate)&&
      (command!=='overrideStartPreparing'||!paymentGate)&&
      (command!=='markFulfilled'||(order.fulfillment_type==='delivery'?
        order.fulfillment_status==='out_for_delivery':order.fulfillment_status==='ready')))
      .map(([command,rule])=>({command,toStatus:rule.to,requiresReason:rule.reasonRequired}));
    const paymentTransitions=payment?Object.entries(PAYMENT_COMMAND_RULES).filter(([command,rule])=>
      rule.from.includes(payment.status as PaymentStatus)&&has(rule.permission)&&
      (!['submitPaymentProof','resubmitPaymentProof','startPaymentReview','approvePayment','rejectPayment']
        .includes(command)||paymentMethod!=='cod')&&
      (command!=='collectCodPayment'||(paymentMethod==='cod'&&order.status==='confirmed'&&
        order.fulfillment_status==='fulfilled'))&&
      (command!=='expirePayment'||(paymentMethod!=='cod'&&payment.expires_at!==null&&
        payment.expires_at<=new Date()))&&
      (command!=='cancelPayment'||payment.status!=='under_review'||
        ['unfulfilled','cancelled'].includes(order.fulfillment_status))).map(([command,rule])=>
      ({command,toStatus:rule.to,requiresReason:rule.reasonRequired})):[];
    return {order:orderTransitions,fulfillment,payment:paymentTransitions};
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
