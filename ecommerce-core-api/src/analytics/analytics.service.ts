import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { parseIanaTimezone } from '../common/utils/timezone.util';
import { OutboxService } from '../messaging/outbox.service';
import { StoresRepository } from '../stores/stores.repository';
import { ANALYTICS_ORDER_STATUSES } from './constants/analytics.constants';
import { AnalyticsRepository } from './analytics.repository';

export interface AnalyticsOverviewResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    grossSales: number;
    netSales: number;
    totalOrders: number;
    averageOrderValue: number;
    cancellationRate: number;
    returnRate: number;
    approvedPaymentsAmount: number;
    approvalRate: number;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    unitsSold: number;
    revenue: number;
    shareOfNetSales: number;
  }>;
}

export interface OrdersStatusBreakdownResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  totalOrders: number;
  items: Array<{ status: string; count: number; percentage: number }>;
}

export interface TopSellingProductsResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    productId: string;
    productTitle: string;
    unitsSold: number;
    revenue: number;
    shareOfNetSales: number;
  }>;
}

export interface FulfillmentSlaResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    transition: string;
    sampleCount: number;
    avgMinutes: number;
    p50Minutes: number;
    p90Minutes: number;
  }>;
}

export interface PaymentsPerformanceResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    totalPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    pendingPayments: number;
    underReviewPayments: number;
    refundedPayments: number;
    approvalRate: number;
    approvedAmount: number;
    avgReviewMinutes: number;
    p50ReviewMinutes: number;
    p90ReviewMinutes: number;
  };
}

export interface PromotionsEfficiencyResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    grossSales: number;
    netSales: number;
    discountTotal: number;
    discountedOrders: number;
    couponOrders: number;
    discountRate: number;
    revenuePerDiscountUnit: number;
    averageDiscountPerDiscountedOrder: number;
  };
  topCoupons: Array<{
    couponCode: string;
    ordersCount: number;
    discountTotal: number;
    netSales: number;
  }>;
}

export interface InventoryHealthResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    totalVariants: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    reservedUnits: number;
    variantsWithSales: number;
    sellThroughRate: number;
  };
  lowStockItems: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
    lowStockThreshold: number;
    unitsSold: number;
  }>;
  slowMovingItems: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
  }>;
}

export interface StockoutRiskResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
    unitsSold: number;
    revenue: number;
    avgDailyUnits: number;
    daysOfCover: number;
  }>;
}

export interface CustomersRetentionResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    activeCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatCustomers: number;
    repeatPurchaseRate: number;
    averageOrdersPerCustomer: number;
  };
  topRepeatCustomers: Array<{
    customerId: string;
    fullName: string;
    phone: string;
    ordersInWindow: number;
    lifetimeOrders: number;
    netSalesInWindow: number;
  }>;
}

export interface FunnelConversionResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  stages: Array<{
    event: string;
    sessions: number;
    stepConversionRate: number;
    fromVisitRate: number;
  }>;
}

export interface SourceAttributionResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    source: string;
    medium: string;
    campaign: string;
    visits: number;
    checkoutStarts: number;
    checkouts: number;
    visitToCheckoutRate: number;
  }>;
}

export interface AffiliatePerformanceResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    affiliateId: string;
    affiliateName: string;
    clicks: number;
    attributedOrders: number;
    conversionRate: number;
    approvedCommissions: number;
    paidCommissions: number;
    pendingCommissions: number;
  }>;
}

export interface AbandonedCartMetricsResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    abandonedCartsCount: number;
    recoveryEmailsSent: number;
    recoveredCartsCount: number;
    recoveredRevenue: number;
    recoveryRate: number;
    abandonmentRate: number;
    averageRecoveryMinutes: number;
  };
}

export interface EventTaxonomyResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    eventName: string;
    baseEventType: string;
    totalEvents: number;
    uniqueSessions: number;
  }>;
}

export interface AnalyticsDataQualityResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{
    key: string;
    value: number;
    severity: 'ok' | 'warning' | 'critical';
    description: string;
  }>;
}

export interface AnalyticsAnomalyReportResponse {
  windowDays: number;
  timezone: string;
  thresholdPercent: number;
  currentWindow: { startAt: Date; endAt: Date };
  previousWindow: { startAt: Date; endAt: Date };
  alerts: Array<{
    key: 'net_sales' | 'total_orders' | 'approved_payments' | 'funnel_conversion';
    severity: 'warning' | 'critical';
    currentValue: number;
    previousValue: number;
    deltaPercent: number;
    message: string;
  }>;
}

export interface AnalyticsGeneralResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  summary: {
    totalSales: number;
    totalOrders: number;
    totalSessions: number;
    totalCustomers: number;
  };
  salesTrend: Array<{ day: string; sales: number; orders: number }>;
  customerJourneyFunnel: FunnelConversionResponse['stages'];
  trafficSources: {
    split: Array<{ sourceType: 'public' | 'affiliate'; visits: number; checkouts: number }>;
    detailed: SourceAttributionResponse['items'];
  };
  paymentMethods: Array<{ key: string; count: number; amount: number }>;
  shippingMethods: Array<{ key: string; count: number; amount: number }>;
  topCustomersByOrders: CustomersRetentionResponse['topRepeatCustomers'];
  topCustomersBySales: CustomersRetentionResponse['topRepeatCustomers'];
  topCitiesByOrders: Array<{ city: string; orders: number; sales: number }>;
  topCitiesBySales: Array<{ city: string; orders: number; sales: number }>;
  topProductsByQuantity: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
  topProductsBySales: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
  orderStatusSummary: OrdersStatusBreakdownResponse['items'];
}

export interface AnalyticsLiveResponse {
  timezone: string;
  liveMinutes: number;
  startAt: Date;
  endAt: Date;
  liveVisits: number;
  topVisitedPages: Array<{ page: string; visits: number }>;
  liveOrders: number;
  liveSales: number;
  topCities: Array<{ city: string; orders: number; sales: number }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
}

export interface AnalyticsProductsResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  items: Array<{
    productId: string;
    productTitle: string;
    totalSales: number;
    totalDiscounts: number;
    salesCount: number;
  }>;
}

export interface AnalyticsOperationsResponse {
  windowDays: number;
  timezone: string;
  startAt: Date;
  endAt: Date;
  kpis: {
    totalShipments: number;
    totalOrders: number;
    avgOrderPreparationMinutes: number;
    avgDeliveryMinutes: number;
    avgReturnMinutes: number;
  };
  paymentMethods: Array<{ key: string; count: number; amount: number }>;
  shippingMethods: Array<{ key: string; count: number; amount: number }>;
  orderStatusSummary: OrdersStatusBreakdownResponse['items'];
}

export interface AnalyticsPaymentsAdvancedResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  metrics: {
    successfulOperations: number;
    failedOperations: number;
    refundedOperations: number;
    pendingOperations: number;
    successRate: number;
    failureRate: number;
    refundRate: number;
    refundedSalesVolume: number;
    successfulSalesVolume: number;
    settledOperations: number;
    depositOperations: number;
    suspendedOperations: number;
    successfulCompletedOperations: number;
    collectedAmount: number;
  };
  methods: Array<{ key: string; count: number; amount: number }>;
}

export interface AnalyticsFinancialResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  totals: {
    grossSalesValue: number;
    ordersCount: number;
    productsSalesValue: number;
    shippingValue: number;
    discountValue: number;
  };
  platformPerformance: Array<{ sourceType: 'public' | 'affiliate'; sales: number; orders: number }>;
}

export interface AnalyticsShipmentsResponse {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: Date;
  endAt: Date;
  counts: {
    totalShipments: number;
    totalOrders: number;
    deliveryOrders: number;
    pickupOrders: number;
    delivered: number;
    inTransit: number;
    cancelled: number;
    failedDelivery: number;
    lost: number;
    damaged: number;
    delayed: number;
    lateReceived: number;
  };
  rates: {
    deliveredRate: number;
    failedRate: number;
    damagedRate: number;
    delayedRate: number;
  };
  fees: {
    totalShippingFees: number;
    averageShippingFee: number;
  };
  methods: Array<{ key: string; count: number; amount: number }>;
  topAreas: Array<{ area: string; orders: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly storesRepository: StoresRepository,
    private readonly outboxService: OutboxService,
  ) {}

  async getOverview(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<AnalyticsOverviewResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);

    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const [overview, payment, orderStatusRows, topProductsRows] = await Promise.all([
      this.analyticsRepository.getOverviewSnapshot({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.getPaymentSnapshot({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listOrdersByStatus({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listTopProducts({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
    ]);

    const grossSales = Number(overview.gross_sales);
    const netSales = Number(overview.net_sales);
    const totalOrders = overview.total_orders;
    const averageOrderValue = overview.net_orders > 0 ? round2(netSales / overview.net_orders) : 0;
    const cancellationRate =
      totalOrders > 0 ? round2((overview.cancelled_orders / totalOrders) * 100) : 0;
    const returnRate = totalOrders > 0 ? round2((overview.returned_orders / totalOrders) * 100) : 0;
    const approvedPaymentsAmount = Number(payment.approved_amount);
    const approvalRate =
      payment.total_payments > 0
        ? round2((payment.approved_payments / payment.total_payments) * 100)
        : 0;

    const ordersByStatusMap = new Map(orderStatusRows.map((row) => [row.status, row.count]));
    const ordersByStatus = ANALYTICS_ORDER_STATUSES.map((status) => ({
      status,
      count: ordersByStatusMap.get(status) ?? 0,
    }));

    const topProducts = topProductsRows.map((row) => {
      const revenue = Number(row.revenue);
      return {
        productId: row.product_id,
        productTitle: row.product_title,
        unitsSold: row.units_sold,
        revenue,
        shareOfNetSales: netSales > 0 ? round2((revenue / netSales) * 100) : 0,
      };
    });

    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        grossSales,
        netSales,
        totalOrders,
        averageOrderValue,
        cancellationRate,
        returnRate,
        approvedPaymentsAmount,
        approvalRate,
      },
      ordersByStatus,
      topProducts,
    };
  }

  async getOrdersStatusBreakdown(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<OrdersStatusBreakdownResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);

    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const rows = await this.analyticsRepository.listOrdersByStatus({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    const totalOrders = rows.reduce((sum, row) => sum + row.count, 0);
    const map = new Map(rows.map((row) => [row.status, row.count]));
    const items = ANALYTICS_ORDER_STATUSES.map((status) => {
      const count = map.get(status) ?? 0;
      return {
        status,
        count,
        percentage: totalOrders > 0 ? round2((count / totalOrders) * 100) : 0,
      };
    });

    return {
      windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      totalOrders,
      items,
    };
  }

  async getTopSellingProducts(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<TopSellingProductsResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);

    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const [overview, rows] = await Promise.all([
      this.analyticsRepository.getOverviewSnapshot({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listTopProducts({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
    ]);

    const netSales = Number(overview.net_sales);
    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items: rows.map((row) => {
        const revenue = Number(row.revenue);
        return {
          productId: row.product_id,
          productTitle: row.product_title,
          unitsSold: row.units_sold,
          revenue,
          shareOfNetSales: netSales > 0 ? round2((revenue / netSales) * 100) : 0,
        };
      }),
    };
  }

  async getFulfillmentSla(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<FulfillmentSlaResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const rows = await this.analyticsRepository.getFulfillmentSla({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    const rowMap = new Map(rows.map((row) => [row.transition_key, row]));
    const items = [
      'new_to_confirmed',
      'confirmed_to_preparing',
      'preparing_to_out_for_delivery',
      'out_for_delivery_to_completed',
    ].map((transition) => {
      const row = rowMap.get(transition);
      return {
        transition,
        sampleCount: row?.sample_count ?? 0,
        avgMinutes: row?.avg_minutes ? round2(row.avg_minutes) : 0,
        p50Minutes: row?.p50_minutes ? round2(row.p50_minutes) : 0,
        p90Minutes: row?.p90_minutes ? round2(row.p90_minutes) : 0,
      };
    });

    return {
      windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items,
    };
  }

  async getPaymentsPerformance(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<PaymentsPerformanceResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const snapshot = await this.analyticsRepository.getPaymentsPerformance({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    return {
      windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        totalPayments: snapshot.total_payments,
        approvedPayments: snapshot.approved_payments,
        rejectedPayments: snapshot.rejected_payments,
        pendingPayments: snapshot.pending_payments,
        underReviewPayments: snapshot.under_review_payments,
        refundedPayments: snapshot.refunded_payments,
        approvalRate:
          snapshot.total_payments > 0
            ? round2((snapshot.approved_payments / snapshot.total_payments) * 100)
            : 0,
        approvedAmount: Number(snapshot.approved_amount),
        avgReviewMinutes: snapshot.avg_review_minutes ? round2(snapshot.avg_review_minutes) : 0,
        p50ReviewMinutes: snapshot.p50_review_minutes ? round2(snapshot.p50_review_minutes) : 0,
        p90ReviewMinutes: snapshot.p90_review_minutes ? round2(snapshot.p90_review_minutes) : 0,
      },
    };
  }

  async getPromotionsEfficiency(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<PromotionsEfficiencyResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const [snapshot, topCoupons] = await Promise.all([
      this.analyticsRepository.getPromotionsEfficiency({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listTopCoupons({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
    ]);

    const grossSales = Number(snapshot.gross_sales);
    const netSales = Number(snapshot.net_sales);
    const discountTotal = Number(snapshot.discount_total);

    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        grossSales,
        netSales,
        discountTotal,
        discountedOrders: snapshot.discounted_orders,
        couponOrders: snapshot.coupon_orders,
        discountRate: netSales > 0 ? round2((discountTotal / netSales) * 100) : 0,
        revenuePerDiscountUnit: discountTotal > 0 ? round2(netSales / discountTotal) : 0,
        averageDiscountPerDiscountedOrder:
          snapshot.discounted_orders > 0 ? round2(discountTotal / snapshot.discounted_orders) : 0,
      },
      topCoupons: topCoupons.map((coupon) => ({
        couponCode: coupon.coupon_code,
        ordersCount: coupon.orders_count,
        discountTotal: Number(coupon.discount_total),
        netSales: Number(coupon.net_sales),
      })),
    };
  }

  async getInventoryHealth(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<InventoryHealthResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);

    const [snapshot, lowStockItems, slowMovingItems] = await Promise.all([
      this.analyticsRepository.getInventoryHealthSnapshot({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listLowStockVariants({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
      this.analyticsRepository.listSlowMovingVariants({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
    ]);

    return {
      windowDays: input.windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        totalVariants: snapshot.total_variants,
        lowStockVariants: snapshot.low_stock_variants,
        outOfStockVariants: snapshot.out_of_stock_variants,
        reservedUnits: snapshot.reserved_units,
        variantsWithSales: snapshot.variants_with_sales,
        sellThroughRate:
          snapshot.total_variants > 0
            ? round2((snapshot.variants_with_sales / snapshot.total_variants) * 100)
            : 0,
      },
      lowStockItems: lowStockItems.map((item) => ({
        variantId: item.variant_id,
        productId: item.product_id,
        productTitle: item.product_title,
        sku: item.sku,
        availableQuantity: item.available_quantity,
        lowStockThreshold: item.low_stock_threshold,
        unitsSold: item.units_sold,
      })),
      slowMovingItems: slowMovingItems.map((item) => ({
        variantId: item.variant_id,
        productId: item.product_id,
        productTitle: item.product_title,
        sku: item.sku,
        availableQuantity: item.available_quantity,
      })),
    };
  }

  async getStockoutRisk(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<StockoutRiskResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const rows = await this.analyticsRepository.listStockoutRisk({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      windowDays: input.windowDays,
      limit: input.limit,
    });

    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items: rows.map((row) => ({
        variantId: row.variant_id,
        productId: row.product_id,
        productTitle: row.product_title,
        sku: row.sku,
        availableQuantity: row.available_quantity,
        unitsSold: row.units_sold,
        revenue: Number(row.revenue),
        avgDailyUnits: round2(row.avg_daily_units),
        daysOfCover: row.days_of_cover ? round2(row.days_of_cover) : 0,
      })),
    };
  }

  async getCustomersRetention(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<CustomersRetentionResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const [snapshot, topRepeatCustomers] = await Promise.all([
      this.analyticsRepository.getCustomerRetentionSnapshot({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
      }),
      this.analyticsRepository.listTopRepeatCustomers({
        storeId: currentUser.storeId,
        startAt: bounds.start_at,
        endAt: bounds.end_at,
        limit: input.limit,
      }),
    ]);

    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        activeCustomers: snapshot.active_customers,
        newCustomers: snapshot.new_customers,
        returningCustomers: snapshot.returning_customers,
        repeatCustomers: snapshot.repeat_customers,
        repeatPurchaseRate:
          snapshot.active_customers > 0
            ? round2((snapshot.repeat_customers / snapshot.active_customers) * 100)
            : 0,
        averageOrdersPerCustomer:
          snapshot.active_customers > 0
            ? round2(snapshot.total_orders / snapshot.active_customers)
            : 0,
      },
      topRepeatCustomers: topRepeatCustomers.map((customer) => ({
        customerId: customer.customer_id,
        fullName: customer.full_name,
        phone: customer.phone,
        ordersInWindow: customer.orders_in_window,
        lifetimeOrders: customer.lifetime_orders,
        netSalesInWindow: Number(customer.net_sales_in_window),
      })),
    };
  }

  async getFunnelConversion(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<FunnelConversionResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const rows = await this.analyticsRepository.getFunnelCounts({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    const map = new Map(rows.map((row) => [row.event_type, row.sessions_count]));
    const ordered = [
      'store_visit',
      'product_view',
      'add_to_cart',
      'checkout_start',
      'checkout_complete',
    ];
    const visits = map.get('store_visit') ?? 0;

    const stages = ordered.map((event, index) => {
      const sessions = map.get(event) ?? 0;
      const prevSessions = index > 0 ? (map.get(ordered[index - 1]!) ?? 0) : sessions;
      return {
        event,
        sessions,
        stepConversionRate:
          index > 0 && prevSessions > 0 ? round2((sessions / prevSessions) * 100) : 100,
        fromVisitRate: visits > 0 ? round2((sessions / visits) * 100) : 0,
      };
    });

    return {
      windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      stages,
    };
  }

  async getSourceAttribution(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<SourceAttributionResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const rows = await this.analyticsRepository.getSourceAttribution({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      limit: input.limit,
    });

    return {
      windowDays: input.windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items: rows.map((row) => ({
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        visits: row.visits,
        checkoutStarts: row.checkout_starts,
        checkouts: row.checkouts,
        visitToCheckoutRate: row.visits > 0 ? round2((row.checkouts / row.visits) * 100) : 0,
      })),
    };
  }

  async getAffiliatePerformance(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<AffiliatePerformanceResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const rows = await this.analyticsRepository.getAffiliatePerformance({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      limit: input.limit,
    });

    return {
      windowDays: input.windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items: rows.map((row) => ({
        affiliateId: row.affiliate_id,
        affiliateName: row.affiliate_name,
        clicks: row.clicks,
        attributedOrders: row.attributed_orders,
        conversionRate: round2(row.conversion_rate),
        approvedCommissions: Number(row.approved_commissions),
        paidCommissions: Number(row.paid_commissions),
        pendingCommissions: Number(row.pending_commissions),
      })),
    };
  }

  async getAbandonedCartMetrics(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<AbandonedCartMetricsResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const metrics = await this.analyticsRepository.getAbandonedCartMetrics({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    const abandonedCartsCount = metrics.abandoned_carts_count;
    const recoveryEmailsSent = metrics.recovery_emails_sent;
    const recoveredCartsCount = metrics.recovered_carts_count;
    const recoveredRevenue = Number(metrics.recovered_revenue);
    const recoveryRate =
      recoveryEmailsSent > 0 ? round2((recoveredCartsCount / recoveryEmailsSent) * 100) : 0;
    const abandonmentRate =
      metrics.checkout_starts > 0
        ? round2((abandonedCartsCount / metrics.checkout_starts) * 100)
        : 0;

    return {
      windowDays,
      timezone,
      currencyCode: store.currency_code,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      kpis: {
        abandonedCartsCount,
        recoveryEmailsSent,
        recoveredCartsCount,
        recoveredRevenue,
        recoveryRate,
        abandonmentRate,
        averageRecoveryMinutes: round2(metrics.avg_recovery_minutes),
      },
    };
  }

  async getEventTaxonomy(
    currentUser: AuthUser,
    input: { windowDays: number; limit: number },
  ): Promise<EventTaxonomyResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, input.windowDays);
    const rows = await this.analyticsRepository.getEventTaxonomy({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      limit: input.limit,
    });

    return {
      windowDays: input.windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      items: rows.map((row) => ({
        eventName: row.event_name,
        baseEventType: row.event_type,
        totalEvents: row.total_events,
        uniqueSessions: row.unique_sessions,
      })),
    };
  }

  async getDataQualityReport(
    currentUser: AuthUser,
    windowDays: number,
  ): Promise<AnalyticsDataQualityResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    const snapshot = await this.analyticsRepository.getDataQualitySnapshot({
      storeId: currentUser.storeId,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
    });

    const checks = [
      {
        key: 'orders_without_items',
        value: snapshot.orders_without_items,
        description: 'Orders recorded without any order items.',
      },
      {
        key: 'payments_without_orders',
        value: snapshot.payments_without_orders,
        description: 'Payments referencing missing orders.',
      },
      {
        key: 'negative_order_totals',
        value: snapshot.negative_order_totals,
        description: 'Orders containing negative monetary totals.',
      },
      {
        key: 'events_without_session',
        value: snapshot.events_without_session,
        description: 'Storefront events with empty session identifiers.',
      },
      {
        key: 'events_in_future',
        value: snapshot.events_in_future,
        description: 'Storefront events timestamped in the future.',
      },
    ].map((check) => ({
      ...check,
      severity: resolveQualitySeverity(check.value),
    }));

    const errorCount = checks.filter((check) => check.severity === 'critical').length;
    const warningCount = checks.filter((check) => check.severity === 'warning').length;
    const score = Math.max(0, 100 - errorCount * 20 - warningCount * 8);

    return {
      windowDays,
      timezone,
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      score,
      status: errorCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy',
      checks,
    };
  }

  async getAnomalyReport(
    currentUser: AuthUser,
    input: { windowDays: number; thresholdPercent: number },
  ): Promise<AnalyticsAnomalyReportResponse> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const timezone = this.resolveStoreTimezone(store.timezone);
    const currentBounds = await this.analyticsRepository.resolveWindowBounds(
      timezone,
      input.windowDays,
    );
    const windowDuration = currentBounds.end_at.getTime() - currentBounds.start_at.getTime();
    const previousBounds = {
      startAt: new Date(currentBounds.start_at.getTime() - windowDuration),
      endAt: new Date(currentBounds.start_at.getTime()),
    };

    const [currentSnapshot, previousSnapshot] = await Promise.all([
      this.analyticsRepository.getKpiWindowSnapshot({
        storeId: currentUser.storeId,
        startAt: currentBounds.start_at,
        endAt: currentBounds.end_at,
      }),
      this.analyticsRepository.getKpiWindowSnapshot({
        storeId: currentUser.storeId,
        startAt: previousBounds.startAt,
        endAt: previousBounds.endAt,
      }),
    ]);

    const currentFunnelConversion =
      currentSnapshot.store_visits > 0
        ? (currentSnapshot.checkout_completes / currentSnapshot.store_visits) * 100
        : 0;
    const previousFunnelConversion =
      previousSnapshot.store_visits > 0
        ? (previousSnapshot.checkout_completes / previousSnapshot.store_visits) * 100
        : 0;

    const alerts = [
      buildAnomalyAlert(
        'net_sales',
        Number(currentSnapshot.net_sales),
        Number(previousSnapshot.net_sales),
        input.thresholdPercent,
      ),
      buildAnomalyAlert(
        'total_orders',
        currentSnapshot.total_orders,
        previousSnapshot.total_orders,
        input.thresholdPercent,
      ),
      buildAnomalyAlert(
        'approved_payments',
        currentSnapshot.approved_payments,
        previousSnapshot.approved_payments,
        input.thresholdPercent,
      ),
      buildAnomalyAlert(
        'funnel_conversion',
        currentFunnelConversion,
        previousFunnelConversion,
        input.thresholdPercent,
      ),
    ].filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));

    return {
      windowDays: input.windowDays,
      timezone,
      thresholdPercent: input.thresholdPercent,
      currentWindow: {
        startAt: currentBounds.start_at,
        endAt: currentBounds.end_at,
      },
      previousWindow: previousBounds,
      alerts,
    };
  }

  async runGovernanceMonitoring(
    currentUser: AuthUser,
    input: { windowDays: number; thresholdPercent: number },
  ): Promise<{
    quality: AnalyticsDataQualityResponse;
    anomalies: AnalyticsAnomalyReportResponse;
    emittedAlerts: number;
  }> {
    const [quality, anomalies] = await Promise.all([
      this.getDataQualityReport(currentUser, input.windowDays),
      this.getAnomalyReport(currentUser, input),
    ]);

    let emittedAlerts = 0;
    for (const alert of anomalies.alerts) {
      if (alert.severity !== 'critical') {
        continue;
      }

      emittedAlerts += 1;
      await this.outboxService.enqueue({
        aggregateType: 'analytics',
        aggregateId: currentUser.storeId,
        eventType: 'analytics.anomaly_detected',
        payload: {
          storeId: currentUser.storeId,
          windowDays: input.windowDays,
          thresholdPercent: input.thresholdPercent,
          key: alert.key,
          severity: alert.severity,
          currentValue: alert.currentValue,
          previousValue: alert.previousValue,
          deltaPercent: alert.deltaPercent,
          message: alert.message,
        },
      });
    }

    return {
      quality,
      anomalies,
      emittedAlerts,
    };
  }

  async getGeneralAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsGeneralResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const [
      overview,
      funnel,
      source,
      retention,
      status,
      salesTrend,
      paymentMethods,
      shippingMethods,
      topCities,
      products,
    ] = await Promise.all([
      this.getOverview(currentUser, { windowDays: context.windowDays, limit: input.limit ?? 10 }),
      this.getFunnelConversion(currentUser, context.windowDays),
      this.getSourceAttribution(currentUser, {
        windowDays: context.windowDays,
        limit: input.limit ?? 10,
      }),
      this.getCustomersRetention(currentUser, {
        windowDays: context.windowDays,
        limit: input.limit ?? 10,
      }),
      this.getOrdersStatusBreakdown(currentUser, context.windowDays),
      this.analyticsRepository.listDailySales({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listPaymentMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listShippingMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listTopCities({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 10,
      }),
      this.analyticsRepository.listProductsPerformance({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 10,
      }),
    ]);

    const totalSessions =
      funnel.stages.find((stage) => stage.event === 'store_visit')?.sessions ?? 0;
    const detailedSources = source.items;
    const trafficSplit = detailedSources.reduce((acc, item) => {
      const isAffiliate =
        item.medium.toLowerCase().includes('affiliate') ||
        item.source.toLowerCase().includes('affiliate');
      const key: 'public' | 'affiliate' = isAffiliate ? 'affiliate' : 'public';
      const row = acc.get(key) ?? { sourceType: key, visits: 0, checkouts: 0 };
      row.visits += item.visits;
      row.checkouts += item.checkouts;
      acc.set(key, row);
      return acc;
    }, new Map<'public' | 'affiliate', { sourceType: 'public' | 'affiliate'; visits: number; checkouts: number }>());

    const topCustomersByOrders = [...retention.topRepeatCustomers].sort(
      (a, b) => b.ordersInWindow - a.ordersInWindow || b.lifetimeOrders - a.lifetimeOrders,
    );
    const topCustomersBySales = [...retention.topRepeatCustomers].sort(
      (a, b) => b.netSalesInWindow - a.netSalesInWindow || b.ordersInWindow - a.ordersInWindow,
    );

    const mappedProducts = products.map((item) => ({
      productId: item.product_id,
      productTitle: item.product_title,
      quantitySold: item.quantity_sold,
      grossSales: Number(item.gross_sales),
    }));

    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      currencyCode: context.currencyCode,
      startAt: context.startAt,
      endAt: context.endAt,
      summary: {
        totalSales: overview.kpis.grossSales,
        totalOrders: overview.kpis.totalOrders,
        totalSessions,
        totalCustomers: retention.kpis.activeCustomers,
      },
      salesTrend: salesTrend.map((item) => ({
        day: item.day,
        sales: Number(item.sales),
        orders: item.orders,
      })),
      customerJourneyFunnel: funnel.stages,
      trafficSources: {
        split: Array.from(trafficSplit.values()),
        detailed: detailedSources,
      },
      paymentMethods: paymentMethods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
      shippingMethods: shippingMethods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
      topCustomersByOrders,
      topCustomersBySales,
      topCitiesByOrders: [...topCities]
        .sort((a, b) => b.orders - a.orders || Number(b.sales) - Number(a.sales))
        .map((item) => ({ city: item.city, orders: item.orders, sales: Number(item.sales) })),
      topCitiesBySales: [...topCities]
        .sort((a, b) => Number(b.sales) - Number(a.sales) || b.orders - a.orders)
        .map((item) => ({ city: item.city, orders: item.orders, sales: Number(item.sales) })),
      topProductsByQuantity: [...mappedProducts].sort(
        (a, b) => b.quantitySold - a.quantitySold || b.grossSales - a.grossSales,
      ),
      topProductsBySales: [...mappedProducts].sort(
        (a, b) => b.grossSales - a.grossSales || b.quantitySold - a.quantitySold,
      ),
      orderStatusSummary: status.items,
    };
  }

  async getLiveAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsLiveResponse> {
    const liveMinutes = input.liveMinutes ?? 15;
    const context = await this.resolveRangeContext(currentUser, { ...input, liveMinutes });

    const [funnel, topPages, overview, topCities, products] = await Promise.all([
      this.getFunnelConversion(currentUser, context.windowDays),
      this.analyticsRepository.listTopVisitedPages({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 10,
      }),
      this.analyticsRepository.getOverviewSnapshot({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listTopCities({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 5,
      }),
      this.analyticsRepository.listProductsPerformance({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 5,
      }),
    ]);

    return {
      timezone: context.timezone,
      liveMinutes,
      startAt: context.startAt,
      endAt: context.endAt,
      liveVisits: funnel.stages.find((stage) => stage.event === 'store_visit')?.sessions ?? 0,
      topVisitedPages: topPages.map((item) => ({ page: item.page, visits: item.visits })),
      liveOrders: overview.total_orders,
      liveSales: Number(overview.gross_sales),
      topCities: topCities.map((item) => ({
        city: item.city,
        orders: item.orders,
        sales: Number(item.sales),
      })),
      topProducts: products.map((item) => ({
        productId: item.product_id,
        productTitle: item.product_title,
        quantitySold: item.quantity_sold,
        grossSales: Number(item.gross_sales),
      })),
    };
  }

  async getProductsAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsProductsResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const rows = await this.analyticsRepository.listProductsPerformance({
      storeId: currentUser.storeId,
      startAt: context.startAt,
      endAt: context.endAt,
      limit: input.limit ?? 100,
    });

    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      currencyCode: context.currencyCode,
      startAt: context.startAt,
      endAt: context.endAt,
      items: rows.map((row) => ({
        productId: row.product_id,
        productTitle: row.product_title,
        totalSales: Number(row.gross_sales),
        totalDiscounts: Number(row.discount_total),
        salesCount: row.quantity_sold,
      })),
    };
  }

  async getOperationsAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsOperationsResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const [shipments, fulfillment, status, paymentMethods, shippingMethods] = await Promise.all([
      this.analyticsRepository.getShipmentSummary({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.getFulfillmentSla(currentUser, context.windowDays),
      this.getOrdersStatusBreakdown(currentUser, context.windowDays),
      this.analyticsRepository.listPaymentMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listShippingMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
    ]);

    const prep =
      fulfillment.items.find((item) => item.transition === 'confirmed_to_preparing')?.avgMinutes ??
      0;
    const delivery =
      fulfillment.items.find((item) => item.transition === 'preparing_to_out_for_delivery')
        ?.avgMinutes ?? 0;
    const returned =
      fulfillment.items.find((item) => item.transition === 'out_for_delivery_to_completed')
        ?.avgMinutes ?? 0;

    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      startAt: context.startAt,
      endAt: context.endAt,
      kpis: {
        totalShipments: shipments.delivery_orders,
        totalOrders: status.totalOrders,
        avgOrderPreparationMinutes: round2(prep),
        avgDeliveryMinutes: round2(delivery),
        avgReturnMinutes: round2(returned),
      },
      paymentMethods: paymentMethods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
      shippingMethods: shippingMethods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
      orderStatusSummary: status.items,
    };
  }

  async getPaymentsAdvancedAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsPaymentsAdvancedResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const [performance, methods] = await Promise.all([
      this.getPaymentsPerformance(currentUser, context.windowDays),
      this.analyticsRepository.listPaymentMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
    ]);

    const total = performance.kpis.totalPayments;
    const successful = performance.kpis.approvedPayments;
    const failed = performance.kpis.rejectedPayments;
    const refunded = performance.kpis.refundedPayments;
    const pending = performance.kpis.pendingPayments + performance.kpis.underReviewPayments;

    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      currencyCode: context.currencyCode,
      startAt: context.startAt,
      endAt: context.endAt,
      metrics: {
        successfulOperations: successful,
        failedOperations: failed,
        refundedOperations: refunded,
        pendingOperations: pending,
        successRate: total > 0 ? round2((successful / total) * 100) : 0,
        failureRate: total > 0 ? round2((failed / total) * 100) : 0,
        refundRate: total > 0 ? round2((refunded / total) * 100) : 0,
        refundedSalesVolume: 0,
        successfulSalesVolume: performance.kpis.approvedAmount,
        settledOperations: successful,
        depositOperations: methods.reduce((acc, item) => acc + item.count, 0),
        suspendedOperations: pending,
        successfulCompletedOperations: successful,
        collectedAmount: performance.kpis.approvedAmount,
      },
      methods: methods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
    };
  }

  async getFinancialAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsFinancialResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const [overview, source, shippingMethods] = await Promise.all([
      this.analyticsRepository.getOverviewSnapshot({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.getSourceAttribution(currentUser, {
        windowDays: context.windowDays,
        limit: input.limit ?? 20,
      }),
      this.analyticsRepository.listShippingMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
    ]);

    const platformBuckets = source.items.reduce((acc, item) => {
      const key: 'public' | 'affiliate' =
        item.medium.toLowerCase().includes('affiliate') ||
        item.source.toLowerCase().includes('affiliate')
          ? 'affiliate'
          : 'public';
      const row = acc.get(key) ?? { sourceType: key, sales: 0, orders: 0 };
      row.orders += item.checkouts;
      acc.set(key, row);
      return acc;
    }, new Map<'public' | 'affiliate', { sourceType: 'public' | 'affiliate'; sales: number; orders: number }>());

    const totalShipping = shippingMethods.reduce((acc, row) => acc + Number(row.amount), 0);

    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      currencyCode: context.currencyCode,
      startAt: context.startAt,
      endAt: context.endAt,
      totals: {
        grossSalesValue: Number(overview.gross_sales),
        ordersCount: overview.total_orders,
        productsSalesValue: Number(overview.net_sales),
        shippingValue: round2(totalShipping),
        discountValue: round2(Number(overview.gross_sales) - Number(overview.net_sales)),
      },
      platformPerformance: Array.from(platformBuckets.values()),
    };
  }

  async getShipmentsAnalytics(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<AnalyticsShipmentsResponse> {
    const context = await this.resolveRangeContext(currentUser, input);
    const [summary, methods, topAreas] = await Promise.all([
      this.analyticsRepository.getShipmentSummary({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listShippingMethodsBreakdown({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
      }),
      this.analyticsRepository.listTopDeliveryAreas({
        storeId: currentUser.storeId,
        startAt: context.startAt,
        endAt: context.endAt,
        limit: input.limit ?? 8,
      }),
    ]);

    const total = summary.total_shipments;
    return {
      windowDays: context.windowDays,
      timezone: context.timezone,
      currencyCode: context.currencyCode,
      startAt: context.startAt,
      endAt: context.endAt,
      counts: {
        totalShipments: summary.total_shipments,
        totalOrders: summary.total_shipments,
        deliveryOrders: summary.delivery_orders,
        pickupOrders: summary.pickup_orders,
        delivered: summary.delivered,
        inTransit: summary.in_transit,
        cancelled: summary.cancelled,
        failedDelivery: summary.failed_delivery,
        lost: summary.lost,
        damaged: summary.damaged,
        delayed: summary.delayed,
        lateReceived: summary.late_received,
      },
      rates: {
        deliveredRate: total > 0 ? round2((summary.delivered / total) * 100) : 0,
        failedRate: total > 0 ? round2((summary.failed_delivery / total) * 100) : 0,
        damagedRate: total > 0 ? round2((summary.damaged / total) * 100) : 0,
        delayedRate: total > 0 ? round2((summary.delayed / total) * 100) : 0,
      },
      fees: {
        totalShippingFees: round2(Number(summary.total_shipping_fees)),
        averageShippingFee: round2(Number(summary.average_shipping_fee)),
      },
      methods: methods.map((item) => ({
        key: item.key,
        count: item.count,
        amount: Number(item.amount),
      })),
      topAreas,
    };
  }

  async exportCustomersReportCsv(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<string> {
    const context = await this.resolveRangeContext(currentUser, input);
    const rows = await this.analyticsRepository.listCustomersReport({
      storeId: currentUser.storeId,
      startAt: context.startAt,
      endAt: context.endAt,
      limit: input.limit ?? 500,
    });

    return buildCsv(
      ['customer_id', 'full_name', 'phone', 'orders_count', 'total_sales'],
      rows.map((row) => [
        row.customer_id,
        row.full_name,
        row.phone,
        String(row.orders_count),
        Number(row.total_sales).toFixed(2),
      ]),
    );
  }

  async exportSalesReportCsv(currentUser: AuthUser, input: AnalyticsRangeInput): Promise<string> {
    const context = await this.resolveRangeContext(currentUser, input);
    const rows = await this.analyticsRepository.listSalesReport({
      storeId: currentUser.storeId,
      startAt: context.startAt,
      endAt: context.endAt,
      limit: input.limit ?? 1000,
    });
    const categoryRows = await this.analyticsRepository.listSalesByCategoryReport({
      storeId: currentUser.storeId,
      startAt: context.startAt,
      endAt: context.endAt,
      limit: input.limit ?? 1000,
    });

    const ordersCsv = buildCsv(
      ['order_code', 'created_at', 'status', 'city', 'total', 'shipping_fee', 'discount_total'],
      rows.map((row) => [
        row.order_code,
        row.created_at.toISOString(),
        row.status,
        row.city,
        Number(row.total).toFixed(2),
        Number(row.shipping_fee).toFixed(2),
        Number(row.discount_total).toFixed(2),
      ]),
    );
    const categoryCsv = buildCsv(
      ['category_name', 'orders_count', 'units_sold', 'gross_sales'],
      categoryRows.map((row) => [
        row.category_name,
        String(row.orders_count),
        String(row.units_sold),
        Number(row.gross_sales).toFixed(2),
      ]),
    );

    return `${ordersCsv}\n\nsales_by_category\n${categoryCsv}`;
  }

  async exportInventoryReportCsv(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<string> {
    const rows = await this.analyticsRepository.listInventoryReport({
      storeId: currentUser.storeId,
      limit: input.limit ?? 1000,
    });

    return buildCsv(
      ['product_title', 'sku', 'stock_quantity', 'reserved_quantity', 'available_quantity'],
      rows.map((row) => [
        row.product_title,
        row.sku,
        String(row.stock_quantity),
        String(row.reserved_quantity),
        String(row.available_quantity),
      ]),
    );
  }

  private async resolveRangeContext(
    currentUser: AuthUser,
    input: AnalyticsRangeInput,
  ): Promise<{
    timezone: string;
    currencyCode: string;
    startAt: Date;
    endAt: Date;
    windowDays: number;
  }> {
    const store = await this.storesRepository.findById(currentUser.storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const timezone = input.timezone
      ? this.resolveStoreTimezone(input.timezone)
      : this.resolveStoreTimezone(store.timezone);
    const now = new Date();
    const liveMinutes = input.liveMinutes ?? 0;

    if (liveMinutes > 0) {
      const endAt = now;
      const startAt = new Date(endAt.getTime() - liveMinutes * 60_000);
      return {
        timezone,
        currencyCode: store.currency_code ?? 'YER',
        startAt,
        endAt,
        windowDays: Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000)),
      };
    }

    if (input.from || input.to) {
      const startAt = input.from
        ? new Date(input.from)
        : new Date(now.getTime() - (input.preset ?? input.window ?? 30) * 86_400_000);
      const endAt = input.to ? new Date(input.to) : now;
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
        throw new BadRequestException('Invalid analytics date range');
      }

      return {
        timezone,
        currencyCode: store.currency_code ?? 'YER',
        startAt,
        endAt,
        windowDays: Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000)),
      };
    }

    const windowDays = input.preset ?? input.window ?? 30;
    const bounds = await this.analyticsRepository.resolveWindowBounds(timezone, windowDays);
    return {
      timezone,
      currencyCode: store.currency_code ?? 'YER',
      startAt: bounds.start_at,
      endAt: bounds.end_at,
      windowDays,
    };
  }

  private resolveStoreTimezone(timezone: string): string {
    const resolved = parseIanaTimezone(timezone);
    if (!resolved) {
      throw new BadRequestException('Store timezone is invalid. Update store settings first.');
    }
    return resolved;
  }
}

export interface AnalyticsRangeInput {
  window?: number;
  preset?: number;
  from?: string;
  to?: string;
  timezone?: string;
  limit?: number;
  liveMinutes?: number;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const escaped = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [headers.map(escaped).join(','), ...rows.map((row) => row.map(escaped).join(','))].join(
    '\n',
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveQualitySeverity(value: number): 'ok' | 'warning' | 'critical' {
  if (value <= 0) {
    return 'ok';
  }
  if (value <= 3) {
    return 'warning';
  }
  return 'critical';
}

function buildAnomalyAlert(
  key: 'net_sales' | 'total_orders' | 'approved_payments' | 'funnel_conversion',
  currentValue: number,
  previousValue: number,
  thresholdPercent: number,
): {
  key: 'net_sales' | 'total_orders' | 'approved_payments' | 'funnel_conversion';
  severity: 'warning' | 'critical';
  currentValue: number;
  previousValue: number;
  deltaPercent: number;
  message: string;
} | null {
  if (previousValue === 0) {
    return null;
  }

  const deltaPercent = round2(((currentValue - previousValue) / previousValue) * 100);
  const absDelta = Math.abs(deltaPercent);
  if (absDelta < thresholdPercent) {
    return null;
  }

  const severity: 'warning' | 'critical' =
    absDelta >= thresholdPercent * 2 ? 'critical' : 'warning';
  return {
    key,
    severity,
    currentValue: round2(currentValue),
    previousValue: round2(previousValue),
    deltaPercent,
    message:
      deltaPercent >= 0
        ? `${key} increased by ${absDelta}% compared with previous window.`
        : `${key} dropped by ${absDelta}% compared with previous window.`,
  };
}
