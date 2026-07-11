import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ANALYTICS_SOLD_ORDER_STATUSES,
  type AnalyticsOrderStatus,
} from './constants/analytics.constants';

const SOLD_ORDER_STATUS = ANALYTICS_SOLD_ORDER_STATUSES[0];

interface WindowBoundsRecord {
  start_at: Date;
  end_at: Date;
}

interface OverviewSnapshotRecord {
  total_orders: number;
  gross_sales: string;
  net_sales: string;
  net_orders: number;
  cancelled_orders: number;
  returned_orders: number;
}

interface PaymentSnapshotRecord {
  total_payments: number;
  approved_payments: number;
  rejected_payments: number;
  approved_amount: string;
}

interface OrdersByStatusRecord {
  status: AnalyticsOrderStatus;
  count: number;
}

interface TopProductRecord {
  product_id: string;
  product_title: string;
  units_sold: number;
  revenue: string;
}

interface FulfillmentSlaRecord {
  transition_key: string;
  sample_count: number;
  avg_minutes: number;
  p50_minutes: number;
  p90_minutes: number;
}

interface PaymentPerformanceRecord {
  total_payments: number;
  pending_payments: number;
  under_review_payments: number;
  approved_payments: number;
  rejected_payments: number;
  refunded_payments: number;
  approved_amount: string;
  review_sample_count: number;
  avg_review_minutes: number | null;
  p50_review_minutes: number | null;
  p90_review_minutes: number | null;
}

interface PromotionsEfficiencyRecord {
  total_orders: number;
  discounted_orders: number;
  coupon_orders: number;
  gross_sales: string;
  net_sales: string;
  discount_total: string;
}

interface TopCouponRecord {
  coupon_code: string;
  orders_count: number;
  discount_total: string;
  net_sales: string;
}

interface InventoryHealthSnapshotRecord {
  total_variants: number;
  low_stock_variants: number;
  out_of_stock_variants: number;
  reserved_units: number;
  variants_with_sales: number;
}

interface InventoryHealthVariantRecord {
  variant_id: string;
  product_id: string;
  product_title: string;
  sku: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  low_stock_threshold: number;
  units_sold: number;
}

interface StockoutRiskRecord {
  variant_id: string;
  product_id: string;
  product_title: string;
  sku: string;
  available_quantity: number;
  units_sold: number;
  revenue: string;
  avg_daily_units: number;
  days_of_cover: number;
}

interface CustomerRetentionSnapshotRecord {
  active_customers: number;
  new_customers: number;
  returning_customers: number;
  repeat_customers: number;
  total_orders: number;
}

interface TopRepeatCustomerRecord {
  customer_id: string;
  full_name: string;
  phone: string;
  orders_in_window: number;
  lifetime_orders: number;
  net_sales_in_window: string;
}

interface FunnelCountRecord {
  event_type: string;
  sessions_count: number;
}

export interface EventTaxonomyRecord {
  event_name: string;
  event_type: string;
  total_events: number;
  unique_sessions: number;
}

interface AttributionRecord {
  source: string;
  medium: string;
  campaign: string;
  visits: number;
  checkout_starts: number;
  checkouts: number;
}

interface DataQualitySnapshotRecord {
  orders_without_items: number;
  payments_without_orders: number;
  negative_order_totals: number;
  events_without_session: number;
  events_in_future: number;
}

interface KpiWindowSnapshotRecord {
  net_sales: string;
  total_orders: number;
  approved_payments: number;
  checkout_completes: number;
  store_visits: number;
}

export interface AbandonedCartMetricsRecord {
  abandoned_carts_count: number;
  recovery_emails_sent: number;
  recovered_carts_count: number;
  recovered_revenue: string;
  avg_recovery_minutes: number;
  checkout_starts: number;
}

export interface DailySalesRecord {
  day: string;
  sales: string;
  orders: number;
}

export interface SimpleCountAmountRecord {
  key: string;
  count: number;
  amount: string;
}

export interface CityPerformanceRecord {
  city: string;
  orders: number;
  sales: string;
}

export interface ProductPerformanceRecord {
  product_id: string;
  product_title: string;
  quantity_sold: number;
  gross_sales: string;
  discount_total: string;
}

export interface TopPageRecord {
  page: string;
  visits: number;
}

export interface ShipmentSummaryRecord {
  total_shipments: number;
  delivered: number;
  in_transit: number;
  cancelled: number;
  failed_delivery: number;
  lost: number;
  damaged: number;
  delayed: number;
  late_received: number;
  pickup_orders: number;
  delivery_orders: number;
  total_shipping_fees: string;
  average_shipping_fee: string;
}

export interface DeliveryAreaRecord {
  area: string;
  orders: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async resolveWindowBounds(timezone: string, windowDays: number): Promise<WindowBoundsRecord> {
    const result = await this.databaseService.db.query<WindowBoundsRecord>(
      `
        SELECT
          (
            date_trunc('day', NOW() AT TIME ZONE $1)
            - (($2::int - 1) * INTERVAL '1 day')
          ) AT TIME ZONE $1 AS start_at,
          (
            date_trunc('day', NOW() AT TIME ZONE $1)
            + INTERVAL '1 day'
          ) AT TIME ZONE $1 AS end_at
      `,
      [timezone, windowDays],
    );

    return result.rows[0] as WindowBoundsRecord;
  }

  async getOverviewSnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<OverviewSnapshotRecord> {
    const result = await this.databaseService.db.query<OverviewSnapshotRecord>(
      `
        WITH scoped_orders AS (
          SELECT status, total
          FROM orders
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        )
        SELECT
          COUNT(*)::int AS total_orders,
          COALESCE(SUM(total), 0)::text AS gross_sales,
          COALESCE(SUM(total) FILTER (WHERE status = '${SOLD_ORDER_STATUS}'), 0)::text AS net_sales,
          COUNT(*) FILTER (WHERE status = '${SOLD_ORDER_STATUS}')::int AS net_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
          COUNT(*) FILTER (WHERE status = 'returned')::int AS returned_orders
        FROM scoped_orders
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_orders: 0,
        gross_sales: '0',
        net_sales: '0',
        net_orders: 0,
        cancelled_orders: 0,
        returned_orders: 0,
      }
    );
  }

  async getPaymentSnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<PaymentSnapshotRecord> {
    const result = await this.databaseService.db.query<PaymentSnapshotRecord>(
      `
        SELECT
          COUNT(*)::int AS total_payments,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_payments,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_payments,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::text AS approved_amount
        FROM payments
        WHERE store_id = $1
          AND created_at >= $2
          AND created_at < $3
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_payments: 0,
        approved_payments: 0,
        rejected_payments: 0,
        approved_amount: '0',
      }
    );
  }

  async listOrdersByStatus(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<OrdersByStatusRecord[]> {
    const result = await this.databaseService.db.query<OrdersByStatusRecord>(
      `
        SELECT status, COUNT(*)::int AS count
        FROM orders
        WHERE store_id = $1
          AND created_at >= $2
          AND created_at < $3
        GROUP BY status
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async listTopProducts(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<TopProductRecord[]> {
    const result = await this.databaseService.db.query<TopProductRecord>(
      `
        SELECT
          oi.product_id,
          COALESCE(NULLIF(TRIM(p.title), ''), MAX(oi.title)) AS product_title,
          COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
          COALESCE(SUM(oi.line_total), 0)::text AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
          AND o.status = '${SOLD_ORDER_STATUS}'
        GROUP BY oi.product_id, p.title
        ORDER BY units_sold DESC, SUM(oi.line_total) DESC, product_title ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getFulfillmentSla(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<FulfillmentSlaRecord[]> {
    const result = await this.databaseService.db.query<FulfillmentSlaRecord>(
      `
        WITH scoped_orders AS (
          SELECT id, created_at
          FROM orders
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        ),
        status_points AS (
          SELECT
            so.id AS order_id,
            so.created_at AS created_at,
            MIN(osh.created_at) FILTER (WHERE osh.new_status = 'confirmed') AS confirmed_at,
            MIN(osh.created_at) FILTER (WHERE osh.new_status = 'preparing') AS preparing_at,
            MIN(osh.created_at) FILTER (WHERE osh.new_status = 'out_for_delivery') AS out_for_delivery_at,
            MIN(osh.created_at) FILTER (WHERE osh.new_status = 'completed') AS completed_at
          FROM scoped_orders so
          LEFT JOIN order_status_history osh
            ON osh.order_id = so.id
           AND osh.store_id = $1
          GROUP BY so.id, so.created_at
        ),
        durations AS (
          SELECT
            'new_to_confirmed'::text AS transition_key,
            EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 60.0 AS minutes
          FROM status_points
          WHERE confirmed_at IS NOT NULL
            AND confirmed_at >= created_at

          UNION ALL

          SELECT
            'confirmed_to_preparing'::text AS transition_key,
            EXTRACT(EPOCH FROM (preparing_at - confirmed_at)) / 60.0 AS minutes
          FROM status_points
          WHERE preparing_at IS NOT NULL
            AND confirmed_at IS NOT NULL
            AND preparing_at >= confirmed_at

          UNION ALL

          SELECT
            'preparing_to_out_for_delivery'::text AS transition_key,
            EXTRACT(EPOCH FROM (out_for_delivery_at - preparing_at)) / 60.0 AS minutes
          FROM status_points
          WHERE out_for_delivery_at IS NOT NULL
            AND preparing_at IS NOT NULL
            AND out_for_delivery_at >= preparing_at

          UNION ALL

          SELECT
            'out_for_delivery_to_completed'::text AS transition_key,
            EXTRACT(EPOCH FROM (completed_at - out_for_delivery_at)) / 60.0 AS minutes
          FROM status_points
          WHERE completed_at IS NOT NULL
            AND out_for_delivery_at IS NOT NULL
            AND completed_at >= out_for_delivery_at
        )
        SELECT
          transition_key,
          COUNT(*)::int AS sample_count,
          AVG(minutes)::float8 AS avg_minutes,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::float8 AS p50_minutes,
          percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes)::float8 AS p90_minutes
        FROM durations
        GROUP BY transition_key
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async getPaymentsPerformance(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<PaymentPerformanceRecord> {
    const result = await this.databaseService.db.query<PaymentPerformanceRecord>(
      `
        WITH scoped_payments AS (
          SELECT status, amount, customer_uploaded_at, reviewed_at
          FROM payments
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        ),
        review_times AS (
          SELECT
            EXTRACT(EPOCH FROM (reviewed_at - customer_uploaded_at)) / 60.0 AS minutes
          FROM scoped_payments
          WHERE customer_uploaded_at IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND status IN ('approved', 'rejected')
            AND reviewed_at >= customer_uploaded_at
        )
        SELECT
          COUNT(*)::int AS total_payments,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_payments,
          COUNT(*) FILTER (WHERE status = 'under_review')::int AS under_review_payments,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_payments,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_payments,
          COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_payments,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::text AS approved_amount,
          (SELECT COUNT(*)::int FROM review_times) AS review_sample_count,
          (SELECT AVG(minutes)::float8 FROM review_times) AS avg_review_minutes,
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::float8 FROM review_times) AS p50_review_minutes,
          (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes)::float8 FROM review_times) AS p90_review_minutes
        FROM scoped_payments
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_payments: 0,
        pending_payments: 0,
        under_review_payments: 0,
        approved_payments: 0,
        rejected_payments: 0,
        refunded_payments: 0,
        approved_amount: '0',
        review_sample_count: 0,
        avg_review_minutes: null,
        p50_review_minutes: null,
        p90_review_minutes: null,
      }
    );
  }

  async getPromotionsEfficiency(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<PromotionsEfficiencyRecord> {
    const result = await this.databaseService.db.query<PromotionsEfficiencyRecord>(
      `
        WITH scoped_orders AS (
          SELECT status, total, discount_total, coupon_code
          FROM orders
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        )
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE discount_total > 0 AND status = '${SOLD_ORDER_STATUS}')::int AS discounted_orders,
          COUNT(*) FILTER (
            WHERE coupon_code IS NOT NULL
              AND BTRIM(coupon_code) <> ''
              AND status = '${SOLD_ORDER_STATUS}'
          )::int AS coupon_orders,
          COALESCE(SUM(total), 0)::text AS gross_sales,
          COALESCE(SUM(total) FILTER (WHERE status = '${SOLD_ORDER_STATUS}'), 0)::text AS net_sales,
          COALESCE(SUM(discount_total) FILTER (WHERE status = '${SOLD_ORDER_STATUS}'), 0)::text AS discount_total
        FROM scoped_orders
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_orders: 0,
        discounted_orders: 0,
        coupon_orders: 0,
        gross_sales: '0',
        net_sales: '0',
        discount_total: '0',
      }
    );
  }

  async listTopCoupons(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<TopCouponRecord[]> {
    const result = await this.databaseService.db.query<TopCouponRecord>(
      `
        SELECT
          coupon_code,
          COUNT(*)::int AS orders_count,
          COALESCE(SUM(discount_total), 0)::text AS discount_total,
          COALESCE(SUM(total), 0)::text AS net_sales
        FROM orders
        WHERE store_id = $1
          AND created_at >= $2
          AND created_at < $3
          AND status = '${SOLD_ORDER_STATUS}'
          AND coupon_code IS NOT NULL
          AND BTRIM(coupon_code) <> ''
        GROUP BY coupon_code
        ORDER BY orders_count DESC, SUM(discount_total) DESC, coupon_code ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getInventoryHealthSnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<InventoryHealthSnapshotRecord> {
    const result = await this.databaseService.db.query<InventoryHealthSnapshotRecord>(
      `
        WITH active_reservations AS (
          SELECT variant_id, SUM(quantity)::int AS reserved_quantity
          FROM inventory_reservations
          WHERE store_id = $1
            AND status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id
        ),
        variant_snapshot AS (
          SELECT
            pv.id AS variant_id,
            pv.low_stock_threshold,
            pv.stock_quantity,
            COALESCE(ar.reserved_quantity, 0)::int AS reserved_quantity,
            GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0)::int AS available_quantity
          FROM product_variants pv
          LEFT JOIN active_reservations ar ON ar.variant_id = pv.id
          WHERE pv.store_id = $1
        ),
        sales_window AS (
          SELECT
            oi.variant_id,
            SUM(oi.quantity)::int AS units_sold
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE o.store_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3
            AND o.status = '${SOLD_ORDER_STATUS}'
          GROUP BY oi.variant_id
        )
        SELECT
          COUNT(*)::int AS total_variants,
          COUNT(*) FILTER (
            WHERE variant_snapshot.low_stock_threshold > 0
              AND variant_snapshot.available_quantity <= variant_snapshot.low_stock_threshold
          )::int AS low_stock_variants,
          COUNT(*) FILTER (WHERE variant_snapshot.available_quantity <= 0)::int AS out_of_stock_variants,
          COALESCE(SUM(variant_snapshot.reserved_quantity), 0)::int AS reserved_units,
          COUNT(*) FILTER (WHERE COALESCE(sales_window.units_sold, 0) > 0)::int AS variants_with_sales
        FROM variant_snapshot
        LEFT JOIN sales_window ON sales_window.variant_id = variant_snapshot.variant_id
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_variants: 0,
        low_stock_variants: 0,
        out_of_stock_variants: 0,
        reserved_units: 0,
        variants_with_sales: 0,
      }
    );
  }

  async listLowStockVariants(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<InventoryHealthVariantRecord[]> {
    const result = await this.databaseService.db.query<InventoryHealthVariantRecord>(
      `
        WITH active_reservations AS (
          SELECT variant_id, SUM(quantity)::int AS reserved_quantity
          FROM inventory_reservations
          WHERE store_id = $1
            AND status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id
        ),
        sales_window AS (
          SELECT
            oi.variant_id,
            SUM(oi.quantity)::int AS units_sold
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE o.store_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3
            AND o.status = '${SOLD_ORDER_STATUS}'
          GROUP BY oi.variant_id
        )
        SELECT
          pv.id AS variant_id,
          pv.product_id,
          p.title AS product_title,
          pv.sku,
          pv.stock_quantity,
          COALESCE(ar.reserved_quantity, 0)::int AS reserved_quantity,
          GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0)::int AS available_quantity,
          pv.low_stock_threshold,
          COALESCE(sw.units_sold, 0)::int AS units_sold
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        LEFT JOIN active_reservations ar ON ar.variant_id = pv.id
        LEFT JOIN sales_window sw ON sw.variant_id = pv.id
        WHERE pv.store_id = $1
          AND pv.low_stock_threshold > 0
          AND GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0) <= pv.low_stock_threshold
        ORDER BY available_quantity ASC, units_sold DESC, p.title ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listSlowMovingVariants(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<InventoryHealthVariantRecord[]> {
    const result = await this.databaseService.db.query<InventoryHealthVariantRecord>(
      `
        WITH active_reservations AS (
          SELECT variant_id, SUM(quantity)::int AS reserved_quantity
          FROM inventory_reservations
          WHERE store_id = $1
            AND status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id
        ),
        sales_window AS (
          SELECT
            oi.variant_id,
            SUM(oi.quantity)::int AS units_sold
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE o.store_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3
            AND o.status = '${SOLD_ORDER_STATUS}'
          GROUP BY oi.variant_id
        )
        SELECT
          pv.id AS variant_id,
          pv.product_id,
          p.title AS product_title,
          pv.sku,
          pv.stock_quantity,
          COALESCE(ar.reserved_quantity, 0)::int AS reserved_quantity,
          GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0)::int AS available_quantity,
          pv.low_stock_threshold,
          COALESCE(sw.units_sold, 0)::int AS units_sold
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        LEFT JOIN active_reservations ar ON ar.variant_id = pv.id
        LEFT JOIN sales_window sw ON sw.variant_id = pv.id
        WHERE pv.store_id = $1
          AND GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0) > 0
          AND COALESCE(sw.units_sold, 0) = 0
        ORDER BY available_quantity DESC, p.title ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listStockoutRisk(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    windowDays: number;
    limit: number;
  }): Promise<StockoutRiskRecord[]> {
    const result = await this.databaseService.db.query<StockoutRiskRecord>(
      `
        WITH active_reservations AS (
          SELECT variant_id, SUM(quantity)::int AS reserved_quantity
          FROM inventory_reservations
          WHERE store_id = $1
            AND status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id
        ),
        sales_window AS (
          SELECT
            oi.variant_id,
            SUM(oi.quantity)::int AS units_sold,
            COALESCE(SUM(oi.line_total), 0)::text AS revenue
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE o.store_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3
            AND o.status = '${SOLD_ORDER_STATUS}'
          GROUP BY oi.variant_id
        )
        SELECT
          pv.id AS variant_id,
          pv.product_id,
          p.title AS product_title,
          pv.sku,
          GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0)::int AS available_quantity,
          sw.units_sold,
          sw.revenue,
          (sw.units_sold::float8 / $4::float8) AS avg_daily_units,
          GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0)::float8
            / NULLIF(sw.units_sold::float8 / $4::float8, 0) AS days_of_cover
        FROM sales_window sw
        INNER JOIN product_variants pv ON pv.id = sw.variant_id
        INNER JOIN products p ON p.id = pv.product_id
        LEFT JOIN active_reservations ar ON ar.variant_id = pv.id
        WHERE pv.store_id = $1
          AND sw.units_sold > 0
          AND GREATEST(pv.stock_quantity - COALESCE(ar.reserved_quantity, 0)::int, 0) >= 0
        ORDER BY days_of_cover ASC NULLS LAST, sw.units_sold DESC, p.title ASC
        LIMIT $5
      `,
      [input.storeId, input.startAt, input.endAt, input.windowDays, input.limit],
    );

    return result.rows;
  }

  async getCustomerRetentionSnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<CustomerRetentionSnapshotRecord> {
    const result = await this.databaseService.db.query<CustomerRetentionSnapshotRecord>(
      `
        WITH valid_orders AS (
          SELECT customer_id, created_at
          FROM orders
          WHERE store_id = $1
            AND customer_id IS NOT NULL
            AND status = '${SOLD_ORDER_STATUS}'
        ),
        customer_lifetime AS (
          SELECT
            customer_id,
            MIN(created_at) AS first_order_at,
            COUNT(*)::int AS lifetime_orders
          FROM valid_orders
          GROUP BY customer_id
        ),
        customer_window AS (
          SELECT
            customer_id,
            COUNT(*)::int AS orders_in_window
          FROM valid_orders
          WHERE created_at >= $2
            AND created_at < $3
          GROUP BY customer_id
        )
        SELECT
          COUNT(*)::int AS active_customers,
          COUNT(*) FILTER (WHERE cl.first_order_at >= $2 AND cl.first_order_at < $3)::int AS new_customers,
          COUNT(*) FILTER (WHERE cl.first_order_at < $2)::int AS returning_customers,
          COUNT(*) FILTER (WHERE cw.orders_in_window >= 2)::int AS repeat_customers,
          COALESCE(SUM(cw.orders_in_window), 0)::int AS total_orders
        FROM customer_window cw
        INNER JOIN customer_lifetime cl ON cl.customer_id = cw.customer_id
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        active_customers: 0,
        new_customers: 0,
        returning_customers: 0,
        repeat_customers: 0,
        total_orders: 0,
      }
    );
  }

  async listTopRepeatCustomers(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<TopRepeatCustomerRecord[]> {
    const result = await this.databaseService.db.query<TopRepeatCustomerRecord>(
      `
        WITH valid_orders AS (
          SELECT customer_id, total, created_at
          FROM orders
          WHERE store_id = $1
            AND customer_id IS NOT NULL
            AND status = '${SOLD_ORDER_STATUS}'
        ),
        lifetime AS (
          SELECT customer_id, COUNT(*)::int AS lifetime_orders
          FROM valid_orders
          GROUP BY customer_id
        ),
        windowed AS (
          SELECT
            customer_id,
            COUNT(*)::int AS orders_in_window,
            COALESCE(SUM(total), 0)::text AS net_sales_in_window
          FROM valid_orders
          WHERE created_at >= $2
            AND created_at < $3
          GROUP BY customer_id
        )
        SELECT
          c.id AS customer_id,
          c.full_name,
          c.phone,
          w.orders_in_window,
          l.lifetime_orders,
          w.net_sales_in_window
        FROM windowed w
        INNER JOIN lifetime l ON l.customer_id = w.customer_id
        INNER JOIN customers c ON c.id = w.customer_id
        ORDER BY w.orders_in_window DESC, l.lifetime_orders DESC, w.net_sales_in_window::numeric DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getFunnelCounts(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<FunnelCountRecord[]> {
    const result = await this.databaseService.db.query<FunnelCountRecord>(
      `
        SELECT
          event_type,
          COUNT(DISTINCT session_id)::int AS sessions_count
        FROM storefront_events
        WHERE store_id = $1
          AND occurred_at >= $2
          AND occurred_at < $3
          AND event_type IN ('store_visit', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_complete')
        GROUP BY event_type
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async getEventTaxonomy(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<EventTaxonomyRecord[]> {
    const result = await this.databaseService.db.query<EventTaxonomyRecord>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(se.metadata->>'eventName'), ''), se.event_type) AS event_name,
          se.event_type,
          COUNT(*)::int AS total_events,
          COUNT(DISTINCT se.session_id)::int AS unique_sessions
        FROM storefront_events se
        WHERE se.store_id = $1
          AND se.occurred_at >= $2
          AND se.occurred_at < $3
        GROUP BY event_name, se.event_type
        ORDER BY total_events DESC, unique_sessions DESC, event_name ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getSourceAttribution(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<AttributionRecord[]> {
    const result = await this.databaseService.db.query<AttributionRecord>(
      `
        WITH scoped AS (
          SELECT session_id, event_type, occurred_at,
                 COALESCE(NULLIF(BTRIM(utm_source), ''), 'direct') AS source,
                 COALESCE(NULLIF(BTRIM(utm_medium), ''), 'none') AS medium,
                 COALESCE(NULLIF(BTRIM(utm_campaign), ''), 'n/a') AS campaign
          FROM storefront_events
          WHERE store_id = $1
            AND occurred_at >= $2
            AND occurred_at < $3
        ),
        session_attr AS (
          SELECT DISTINCT ON (session_id)
            session_id,
            source,
            medium,
            campaign
          FROM scoped
          ORDER BY session_id, occurred_at DESC
        ),
        visits AS (
          SELECT session_id
          FROM scoped
          WHERE event_type = 'store_visit'
          GROUP BY session_id
        ),
        checkout_starts AS (
          SELECT session_id
          FROM scoped
          WHERE event_type = 'checkout_start'
          GROUP BY session_id
        ),
        checkouts AS (
          SELECT session_id
          FROM scoped
          WHERE event_type = 'checkout_complete'
          GROUP BY session_id
        )
        SELECT
          sa.source,
          sa.medium,
          sa.campaign,
          COUNT(v.session_id)::int AS visits,
          COUNT(cs.session_id)::int AS checkout_starts,
          COUNT(c.session_id)::int AS checkouts
        FROM session_attr sa
        LEFT JOIN visits v ON v.session_id = sa.session_id
        LEFT JOIN checkout_starts cs ON cs.session_id = sa.session_id
        LEFT JOIN checkouts c ON c.session_id = sa.session_id
        GROUP BY sa.source, sa.medium, sa.campaign
        ORDER BY checkouts DESC, checkout_starts DESC, visits DESC, sa.source ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getAffiliatePerformance(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<
    Array<{
      affiliate_id: string;
      affiliate_name: string;
      clicks: number;
      attributed_orders: number;
      approved_commissions: string;
      paid_commissions: string;
      pending_commissions: string;
      conversion_rate: number;
    }>
  > {
    const result = await this.databaseService.db.query<{
      affiliate_id: string;
      affiliate_name: string;
      clicks: number;
      attributed_orders: number;
      approved_commissions: string;
      paid_commissions: string;
      pending_commissions: string;
      conversion_rate: number;
    }>(
      `
        WITH clicks AS (
          SELECT affiliate_id, COUNT(*)::int AS clicks
          FROM affiliate_clicks
          WHERE store_id = $1
            AND clicked_at >= $2
            AND clicked_at < $3
          GROUP BY affiliate_id
        ),
        attributed AS (
          SELECT affiliate_id, COUNT(*)::int AS attributed_orders
          FROM order_affiliate_attributions
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
          GROUP BY affiliate_id
        ),
        commissions AS (
          SELECT
            affiliate_id,
            COALESCE(SUM(net_amount) FILTER (WHERE status = 'approved'), 0)::text AS approved_commissions,
            COALESCE(SUM(net_amount) FILTER (WHERE status = 'paid'), 0)::text AS paid_commissions,
            COALESCE(SUM(net_amount) FILTER (WHERE status = 'pending'), 0)::text AS pending_commissions
          FROM affiliate_commissions
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
          GROUP BY affiliate_id
        )
        SELECT
          a.id AS affiliate_id,
          a.name AS affiliate_name,
          COALESCE(c.clicks, 0) AS clicks,
          COALESCE(at.attributed_orders, 0) AS attributed_orders,
          COALESCE(cm.approved_commissions, '0') AS approved_commissions,
          COALESCE(cm.paid_commissions, '0') AS paid_commissions,
          COALESCE(cm.pending_commissions, '0') AS pending_commissions,
          CASE
            WHEN COALESCE(c.clicks, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(at.attributed_orders, 0)::numeric / c.clicks::numeric) * 100, 2)::float8
          END AS conversion_rate
        FROM affiliates a
        LEFT JOIN clicks c ON c.affiliate_id = a.id
        LEFT JOIN attributed at ON at.affiliate_id = a.id
        LEFT JOIN commissions cm ON cm.affiliate_id = a.id
        WHERE a.store_id = $1
          AND (
            COALESCE(c.clicks, 0) > 0
            OR COALESCE(at.attributed_orders, 0) > 0
            OR COALESCE(cm.approved_commissions, '0')::numeric > 0
            OR COALESCE(cm.pending_commissions, '0')::numeric > 0
          )
        ORDER BY COALESCE(cm.approved_commissions, '0')::numeric DESC, COALESCE(at.attributed_orders, 0) DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getDataQualitySnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<DataQualitySnapshotRecord> {
    const result = await this.databaseService.db.query<DataQualitySnapshotRecord>(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM orders o
            WHERE o.store_id = $1
              AND o.created_at >= $2
              AND o.created_at < $3
              AND NOT EXISTS (
                SELECT 1
                FROM order_items oi
                WHERE oi.order_id = o.id
              )
          ) AS orders_without_items,
          (
            SELECT COUNT(*)::int
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            WHERE p.store_id = $1
              AND p.created_at >= $2
              AND p.created_at < $3
              AND o.id IS NULL
          ) AS payments_without_orders,
          (
            SELECT COUNT(*)::int
            FROM orders o
            WHERE o.store_id = $1
              AND o.created_at >= $2
              AND o.created_at < $3
              AND (o.total < 0 OR o.subtotal < 0 OR o.shipping_fee < 0 OR o.discount_total < 0)
          ) AS negative_order_totals,
          (
            SELECT COUNT(*)::int
            FROM storefront_events se
            WHERE se.store_id = $1
              AND se.occurred_at >= $2
              AND se.occurred_at < $3
              AND (se.session_id IS NULL OR BTRIM(se.session_id) = '')
          ) AS events_without_session,
          (
            SELECT COUNT(*)::int
            FROM storefront_events se
            WHERE se.store_id = $1
              AND se.occurred_at >= $2
              AND se.occurred_at < $3
              AND se.occurred_at > NOW() + INTERVAL '5 minutes'
          ) AS events_in_future
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        orders_without_items: 0,
        payments_without_orders: 0,
        negative_order_totals: 0,
        events_without_session: 0,
        events_in_future: 0,
      }
    );
  }

  async getKpiWindowSnapshot(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<KpiWindowSnapshotRecord> {
    const result = await this.databaseService.db.query<KpiWindowSnapshotRecord>(
      `
        WITH order_stats AS (
          SELECT
            COALESCE(SUM(total) FILTER (WHERE status = '${SOLD_ORDER_STATUS}'), 0)::text AS net_sales,
            COUNT(*) FILTER (WHERE status = '${SOLD_ORDER_STATUS}')::int AS total_orders
          FROM orders
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        ),
        payment_stats AS (
          SELECT COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_payments
          FROM payments
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        ),
        funnel_stats AS (
          SELECT
            COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'checkout_complete')::int AS checkout_completes,
            COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'store_visit')::int AS store_visits
          FROM storefront_events
          WHERE store_id = $1
            AND occurred_at >= $2
            AND occurred_at < $3
        )
        SELECT
          order_stats.net_sales,
          order_stats.total_orders,
          payment_stats.approved_payments,
          funnel_stats.checkout_completes,
          funnel_stats.store_visits
        FROM order_stats, payment_stats, funnel_stats
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        net_sales: '0',
        total_orders: 0,
        approved_payments: 0,
        checkout_completes: 0,
        store_visits: 0,
      }
    );
  }

  async getAbandonedCartMetrics(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<AbandonedCartMetricsRecord> {
    const result = await this.databaseService.db.query<AbandonedCartMetricsRecord>(
      `
        WITH scoped_abandoned AS (
          SELECT *
          FROM abandoned_carts
          WHERE store_id = $1
            AND created_at >= $2
            AND created_at < $3
        ),
        scoped_recovered_orders AS (
          SELECT ac.recovered_order_id
          FROM scoped_abandoned ac
          WHERE ac.recovered_at IS NOT NULL
            AND ac.recovered_order_id IS NOT NULL
            AND ac.recovered_at >= $2
            AND ac.recovered_at < $3
        )
        SELECT
          (SELECT COUNT(*)::int FROM scoped_abandoned) AS abandoned_carts_count,
          (
            SELECT COUNT(*)::int
            FROM scoped_abandoned ac
            WHERE ac.recovery_sent_at IS NOT NULL
              AND ac.recovery_sent_at >= $2
              AND ac.recovery_sent_at < $3
          ) AS recovery_emails_sent,
          (
            SELECT COUNT(*)::int
            FROM scoped_abandoned ac
            WHERE ac.recovered_at IS NOT NULL
              AND ac.recovered_at >= $2
              AND ac.recovered_at < $3
          ) AS recovered_carts_count,
          (
            SELECT COALESCE(SUM(o.total), 0)::text
            FROM orders o
            WHERE o.id IN (SELECT recovered_order_id FROM scoped_recovered_orders)
          ) AS recovered_revenue,
          (
            SELECT COALESCE(
              AVG(EXTRACT(EPOCH FROM (ac.recovered_at - ac.recovery_sent_at)) / 60),
              0
            )::float8
            FROM scoped_abandoned ac
            WHERE ac.recovered_at IS NOT NULL
              AND ac.recovery_sent_at IS NOT NULL
              AND ac.recovered_at >= $2
              AND ac.recovered_at < $3
          ) AS avg_recovery_minutes,
          (
            SELECT COUNT(DISTINCT se.session_id)::int
            FROM storefront_events se
            WHERE se.store_id = $1
              AND se.event_type = 'checkout_start'
              AND se.occurred_at >= $2
              AND se.occurred_at < $3
          ) AS checkout_starts
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        abandoned_carts_count: 0,
        recovery_emails_sent: 0,
        recovered_carts_count: 0,
        recovered_revenue: '0',
        avg_recovery_minutes: 0,
        checkout_starts: 0,
      }
    );
  }

  async listDailySales(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<DailySalesRecord[]> {
    const result = await this.databaseService.db.query<DailySalesRecord>(
      `
        SELECT
          to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS day,
          COALESCE(SUM(o.total) FILTER (WHERE o.status = '${SOLD_ORDER_STATUS}'), 0)::text AS sales,
          COUNT(*)::int AS orders
        FROM orders o
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
        GROUP BY date_trunc('day', o.created_at)
        ORDER BY date_trunc('day', o.created_at) ASC
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async listPaymentMethodsBreakdown(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<SimpleCountAmountRecord[]> {
    const result = await this.databaseService.db.query<SimpleCountAmountRecord>(
      `
        SELECT
          p.method AS key,
          COUNT(*)::int AS count,
          COALESCE(SUM(p.amount), 0)::text AS amount
        FROM payments p
        WHERE p.store_id = $1
          AND p.created_at >= $2
          AND p.created_at < $3
        GROUP BY p.method
        ORDER BY COUNT(*) DESC, p.method ASC
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async listShippingMethodsBreakdown(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<SimpleCountAmountRecord[]> {
    const result = await this.databaseService.db.query<SimpleCountAmountRecord>(
      `
        SELECT
          COALESCE(
            NULLIF(BTRIM(o.shipping_method_snapshot->>'displayName'), ''),
            NULLIF(BTRIM(sm.display_name), ''),
            'unassigned'
          ) AS key,
          COUNT(*)::int AS count,
          COALESCE(SUM(o.shipping_fee), 0)::text AS amount
        FROM orders o
        LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
        GROUP BY key
        ORDER BY count DESC, key ASC
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return result.rows;
  }

  async listTopCities(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<CityPerformanceRecord[]> {
    const result = await this.databaseService.db.query<CityPerformanceRecord>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(o.shipping_address->>'city'), ''), 'غير محدد') AS city,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o.total) FILTER (WHERE o.status = '${SOLD_ORDER_STATUS}'), 0)::text AS sales
        FROM orders o
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
        GROUP BY city
        ORDER BY
          COUNT(*) DESC,
          COALESCE(SUM(o.total) FILTER (WHERE o.status = '${SOLD_ORDER_STATUS}'), 0) DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listProductsPerformance(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<ProductPerformanceRecord[]> {
    const result = await this.databaseService.db.query<ProductPerformanceRecord>(
      `
        SELECT
          oi.product_id,
          COALESCE(NULLIF(TRIM(p.title), ''), MAX(oi.title)) AS product_title,
          COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold,
          COALESCE(SUM(oi.line_total), 0)::text AS gross_sales,
          COALESCE(SUM(
            CASE
              WHEN o.subtotal > 0 THEN (o.discount_total * oi.line_total / o.subtotal)
              ELSE 0
            END
          ), 0)::text AS discount_total
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
          AND o.status = '${SOLD_ORDER_STATUS}'
        GROUP BY oi.product_id, p.title
        ORDER BY
          COALESCE(SUM(oi.quantity), 0) DESC,
          COALESCE(SUM(oi.line_total), 0) DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listTopVisitedPages(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<TopPageRecord[]> {
    const result = await this.databaseService.db.query<TopPageRecord>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(se.metadata->>'path'), ''), se.event_type) AS page,
          COUNT(*)::int AS visits
        FROM storefront_events se
        WHERE se.store_id = $1
          AND se.occurred_at >= $2
          AND se.occurred_at < $3
        GROUP BY page
        ORDER BY visits DESC, page ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async getShipmentSummary(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
  }): Promise<ShipmentSummaryRecord> {
    const result = await this.databaseService.db.query<ShipmentSummaryRecord>(
      `
        SELECT
          COUNT(*)::int AS total_shipments,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS delivered,
          COUNT(*) FILTER (WHERE status IN ('confirmed', 'preparing', 'out_for_delivery'))::int AS in_transit,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          COUNT(*) FILTER (WHERE status = 'returned')::int AS failed_delivery,
          0::int AS lost,
          0::int AS damaged,
          0::int AS delayed,
          0::int AS late_received,
          COUNT(*) FILTER (WHERE fulfillment_type = 'pickup' OR shipping_method_snapshot->>'type' = 'store_pickup')::int AS pickup_orders,
          COUNT(*) FILTER (WHERE COALESCE(fulfillment_type, 'delivery') <> 'pickup' AND COALESCE(shipping_method_snapshot->>'type', '') <> 'store_pickup')::int AS delivery_orders,
          COALESCE(SUM(shipping_fee), 0)::text AS total_shipping_fees,
          COALESCE(AVG(shipping_fee), 0)::text AS average_shipping_fee
        FROM orders
        WHERE store_id = $1
          AND created_at >= $2
          AND created_at < $3
      `,
      [input.storeId, input.startAt, input.endAt],
    );

    return (
      result.rows[0] ?? {
        total_shipments: 0,
        delivered: 0,
        in_transit: 0,
        cancelled: 0,
        failed_delivery: 0,
        lost: 0,
        damaged: 0,
        delayed: 0,
        late_received: 0,
        pickup_orders: 0,
        delivery_orders: 0,
        total_shipping_fees: '0',
        average_shipping_fee: '0',
      }
    );
  }

  async listTopDeliveryAreas(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<DeliveryAreaRecord[]> {
    const result = await this.databaseService.db.query<DeliveryAreaRecord>(
      `
        SELECT
          COALESCE(
            NULLIF(BTRIM(o.shipping_address->>'area'), ''),
            NULLIF(BTRIM(o.shipping_address->>'city'), ''),
            'غير محدد'
          ) AS area,
          COUNT(*)::int AS orders
        FROM orders o
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
          AND COALESCE(o.fulfillment_type, 'delivery') <> 'pickup'
          AND COALESCE(o.shipping_method_snapshot->>'type', '') <> 'store_pickup'
        GROUP BY area
        ORDER BY orders DESC, area ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listCustomersReport(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<
    Array<{
      customer_id: string;
      full_name: string;
      phone: string;
      orders_count: number;
      total_sales: string;
    }>
  > {
    const result = await this.databaseService.db.query<{
      customer_id: string;
      full_name: string;
      phone: string;
      orders_count: number;
      total_sales: string;
    }>(
      `
        SELECT
          c.id AS customer_id,
          c.full_name,
          c.phone,
          COUNT(o.id)::int AS orders_count,
          COALESCE(SUM(o.total) FILTER (WHERE o.status = '${SOLD_ORDER_STATUS}'), 0)::text AS total_sales
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
          AND o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
        WHERE c.store_id = $1
        GROUP BY c.id, c.full_name, c.phone
        ORDER BY
          COUNT(o.id) DESC,
          COALESCE(SUM(o.total) FILTER (WHERE o.status = '${SOLD_ORDER_STATUS}'), 0) DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listSalesReport(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<
    Array<{
      order_code: string;
      created_at: Date;
      status: string;
      city: string;
      total: string;
      shipping_fee: string;
      discount_total: string;
    }>
  > {
    const result = await this.databaseService.db.query<{
      order_code: string;
      created_at: Date;
      status: string;
      city: string;
      total: string;
      shipping_fee: string;
      discount_total: string;
    }>(
      `
        SELECT
          o.order_code,
          o.created_at,
          o.status,
          COALESCE(NULLIF(BTRIM(o.shipping_address->>'city'), ''), 'غير محدد') AS city,
          o.total::text AS total,
          o.shipping_fee::text AS shipping_fee,
          o.discount_total::text AS discount_total
        FROM orders o
        WHERE o.store_id = $1
          AND o.created_at >= $2
          AND o.created_at < $3
        ORDER BY o.created_at DESC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listSalesByCategoryReport(input: {
    storeId: string;
    startAt: Date;
    endAt: Date;
    limit: number;
  }): Promise<
    Array<{ category_name: string; orders_count: number; units_sold: number; gross_sales: string }>
  > {
    const result = await this.databaseService.db.query<{
      category_name: string;
      orders_count: number;
      units_sold: number;
      gross_sales: string;
    }>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(c.name_ar), ''), NULLIF(BTRIM(c.name_en), ''), NULLIF(BTRIM(c.name), ''), 'غير مصنف') AS category_name,
          COUNT(DISTINCT o.id)::int AS orders_count,
          COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
          COALESCE(SUM(oi.line_total), 0)::text AS gross_sales
        FROM order_items oi
        INNER JOIN orders o
          ON o.id = oi.order_id
         AND o.store_id = $1
        LEFT JOIN product_categories pc
          ON pc.store_id = o.store_id
         AND pc.product_id = oi.product_id
        LEFT JOIN products p
          ON p.store_id = o.store_id
         AND p.id = oi.product_id
        LEFT JOIN categories c
          ON c.store_id = o.store_id
         AND c.id = COALESCE(pc.category_id, p.category_id)
        WHERE o.created_at >= $2
          AND o.created_at < $3
          AND o.status = '${SOLD_ORDER_STATUS}'
        GROUP BY category_name
        ORDER BY SUM(oi.line_total) DESC NULLS LAST, units_sold DESC, category_name ASC
        LIMIT $4
      `,
      [input.storeId, input.startAt, input.endAt, input.limit],
    );

    return result.rows;
  }

  async listInventoryReport(input: { storeId: string; limit: number }): Promise<
    Array<{
      product_title: string;
      sku: string;
      stock_quantity: number;
      reserved_quantity: number;
      available_quantity: number;
    }>
  > {
    const result = await this.databaseService.db.query<{
      product_title: string;
      sku: string;
      stock_quantity: number;
      reserved_quantity: number;
      available_quantity: number;
    }>(
      `
        WITH inventory_by_variant AS (
          SELECT
            variant_id,
            SUM(quantity)::int AS stock_quantity,
            SUM(reserved_quantity)::int AS reserved_quantity
          FROM warehouse_inventory
          WHERE store_id = $1
          GROUP BY variant_id
        ),
        active_reservations AS (
          SELECT variant_id, SUM(quantity)::int AS active_reserved_quantity
          FROM inventory_reservations
          WHERE store_id = $1
            AND status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id
        )
        SELECT
          p.title AS product_title,
          pv.sku,
          COALESCE(ibv.stock_quantity, 0)::int AS stock_quantity,
          GREATEST(COALESCE(ibv.reserved_quantity, 0)::int, COALESCE(ar.active_reserved_quantity, 0)::int) AS reserved_quantity,
          GREATEST(
            COALESCE(ibv.stock_quantity, 0)::int
              - GREATEST(COALESCE(ibv.reserved_quantity, 0)::int, COALESCE(ar.active_reserved_quantity, 0)::int),
            0
          )::int AS available_quantity
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        LEFT JOIN inventory_by_variant ibv ON ibv.variant_id = pv.id
        LEFT JOIN active_reservations ar ON ar.variant_id = pv.id
        WHERE pv.store_id = $1
        ORDER BY available_quantity ASC, p.title ASC
        LIMIT $2
      `,
      [input.storeId, input.limit],
    );

    return result.rows;
  }
}
