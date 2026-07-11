import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { OrderStatus } from './constants/order-status.constants';
import type { PaymentMethod } from './constants/payment.constants';

export type PaymentStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'refunded';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface StoreVariantSnapshot {
  variant_id: string;
  product_id: string;
  product_status: string;
  product_is_visible: boolean;
  product_type: 'single' | 'bundled' | 'digital';
  stock_unlimited: boolean;
  product_title: string;
  sku: string;
  variant_title: string;
  price: string;
  price_yer?: string;
  product_weight: string | null;
  stock_quantity: number;
  attributes: Record<string, string>;
}

export interface CartRecord {
  id: string;
  store_id: string;
  status: 'open' | 'checked_out' | 'abandoned';
  currency_code: string;
  exchange_rate_yer_per_unit: string;
}

export interface CartItemSnapshot {
  cart_item_id: string;
  store_id: string;
  product_id: string;
  category_id: string | null;
  product_type: 'single' | 'bundled' | 'digital';
  stock_unlimited: boolean;
  variant_id: string;
  quantity: number;
  unit_price: string;
  unit_price_yer: string;
  current_price_yer: string;
  product_weight: string | null;
  stock_quantity: number;
  product_title: string;
  sku: string;
  attributes: Record<string, string>;
}

export interface OrderRecord {
  id: string;
  store_id: string;
  customer_id: string | null;
  order_code: string;
  status: OrderStatus;
  subtotal: string;
  total: string;
  shipping_zone_id: string | null;
  shipping_method_id?: string | null;
  shipping_method_snapshot?: Record<string, unknown> | null;
  shipping_fee: string;
  discount_total: string;
  points_redeemed: number;
  points_discount_amount: string;
  points_earned: number;
  coupon_code: string | null;
  currency_code: string;
  exchange_rate_yer_per_unit: string;
  subtotal_yer: string;
  total_yer: string;
  shipping_fee_yer: string;
  discount_total_yer: string;
  points_discount_amount_yer: string;
  note: string | null;
  shipping_address: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface OrderListRow extends OrderRecord {
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: PaymentMethod | null;
  payment_method_code: string | null;
  payment_method_name: string | null;
  payment_status: PaymentStatus | null;
}

export interface OrderStatusCountRow {
  status: OrderStatus;
  count: string;
}

export interface ManualProductSearchRow {
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  sku: string;
  price: string;
  stock_unlimited: boolean;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

export interface CustomerSummaryRow {
  id: string;
  full_name: string;
  phone: string;
}

export interface CustomerAddressSummaryRow {
  id: string;
  customer_id: string;
  address_line: string;
  city: string | null;
  area: string | null;
  notes: string | null;
  is_default: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  map_provider?: string | null;
  place_label?: string | null;
}

interface OrdersListFilters {
  storeId: string;
  status?: OrderStatus;
  q?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  title: string;
  sku: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  unit_price_yer: string;
  line_total_yer: string;
  attributes: Record<string, string>;
}

export interface OrderStatusHistoryRecord {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: Date;
}

interface CreateOrderInput {
  id: string;
  storeId: string;
  customerId: string;
  orderCode: string;
  subtotal: number;
  total: number;
  shippingZoneId: string | null;
  shippingMethodId?: string | null;
  shippingMethodSnapshot?: Record<string, unknown> | null;
  fulfillmentType?: 'delivery' | 'pickup' | 'external_shipping' | 'manual_coordination';
  shippingFee: number;
  discountTotal: number;
  couponCode: string | null;
  currencyCode: string;
  exchangeRateYerPerUnit: number;
  subtotalYER: number;
  totalYER: number;
  shippingFeeYER: number;
  discountTotalYER: number;
  pointsDiscountAmountYER: number;
  note: string | null;
  shippingAddress: Record<string, unknown>;
}

const ORDER_RETURNING_FIELDS =
  'id, store_id, customer_id, order_code, status, subtotal, total, shipping_zone_id, shipping_method_id, shipping_method_snapshot, shipping_fee, discount_total, points_redeemed, points_discount_amount, points_earned, coupon_code, currency_code, exchange_rate_yer_per_unit, subtotal_yer, total_yer, shipping_fee_yer, discount_total_yer, points_discount_amount_yer, note, shipping_address, created_at, updated_at';

const INSERT_ORDER_QUERY = `
  INSERT INTO orders (
    id,
    store_id,
    customer_id,
    order_code,
    status,
    subtotal,
    total,
    shipping_zone_id,
    shipping_method_id,
    shipping_method_snapshot,
    fulfillment_type,
    shipping_fee,
    discount_total,
    coupon_code,
    currency_code,
    exchange_rate_yer_per_unit,
    subtotal_yer,
    total_yer,
    shipping_fee_yer,
    discount_total_yer,
    points_discount_amount_yer,
    note,
    shipping_address
  ) VALUES ($1, $2, $3, $4, 'new', $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb)
  RETURNING ${ORDER_RETURNING_FIELDS}
`;

@Injectable()
export class OrdersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findVariantForStore(
    storeId: string,
    variantId: string,
  ): Promise<StoreVariantSnapshot | null> {
    const result = await this.databaseService.db.query<StoreVariantSnapshot>(
      `
        SELECT
          pv.id AS variant_id,
          pv.product_id,
          p.status AS product_status,
          p.is_visible AS product_is_visible,
          p.product_type,
          p.stock_unlimited,
          p.title AS product_title,
          pv.sku,
          pv.title AS variant_title,
          pv.price,
          p.weight AS product_weight,
          pv.stock_quantity,
          pv.attributes
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        WHERE pv.store_id = $1
          AND pv.id = $2
        LIMIT 1
      `,
      [storeId, variantId],
    );

    return result.rows[0] ?? null;
  }

  async findOpenCartById(storeId: string, cartId: string): Promise<CartRecord | null> {
    const result = await this.databaseService.db.query<CartRecord>(
      `
        SELECT id, store_id, status, currency_code, exchange_rate_yer_per_unit
        FROM carts
        WHERE store_id = $1
          AND id = $2
          AND status IN ('open', 'abandoned')
        LIMIT 1
      `,
      [storeId, cartId],
    );
    return result.rows[0] ?? null;
  }

  async createCart(
    storeId: string,
    currencyCode: string,
    exchangeRateYerPerUnit = 1,
  ): Promise<CartRecord> {
    const result = await this.databaseService.db.query<CartRecord>(
      `
        INSERT INTO carts (id, store_id, status, currency_code, exchange_rate_yer_per_unit)
        VALUES ($1, $2, 'open', $3, $4)
        RETURNING id, store_id, status, currency_code, exchange_rate_yer_per_unit
      `,
      [uuidv4(), storeId, currencyCode, exchangeRateYerPerUnit],
    );
    return result.rows[0] as CartRecord;
  }

  async addOrIncrementCartItem(input: {
    cartId: string;
    storeId: string;
    productId: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    unitPriceYER: number;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO cart_items (
          id,
          cart_id,
          store_id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          unit_price_yer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (cart_id, variant_id)
        DO UPDATE SET
          quantity = cart_items.quantity + EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          unit_price_yer = EXCLUDED.unit_price_yer,
          updated_at = NOW()
      `,
      [
        uuidv4(),
        input.cartId,
        input.storeId,
        input.productId,
        input.variantId,
        input.quantity,
        input.unitPrice,
        input.unitPriceYER,
      ],
    );

    await this.touchCart(input.cartId);
  }

  async listCartItems(storeId: string, cartId: string): Promise<CartItemSnapshot[]> {
    const result = await this.databaseService.db.query<CartItemSnapshot>(
      `
        SELECT
          ci.id AS cart_item_id,
          ci.store_id,
          ci.product_id,
          p.category_id,
          p.product_type,
          p.stock_unlimited,
          ci.variant_id,
          ci.quantity,
          ci.unit_price,
          ci.unit_price_yer,
          pv.price AS current_price_yer,
          p.weight AS product_weight,
          pv.stock_quantity,
          p.title AS product_title,
          pv.sku,
          pv.attributes
        FROM cart_items ci
        INNER JOIN product_variants pv ON pv.id = ci.variant_id
        INNER JOIN products p ON p.id = ci.product_id
        WHERE ci.store_id = $1
          AND ci.cart_id = $2
        ORDER BY ci.created_at ASC
      `,
      [storeId, cartId],
    );

    return result.rows;
  }

  async updateCartCurrency(input: {
    storeId: string;
    cartId: string;
    currencyCode: string;
    exchangeRateYerPerUnit: number;
  }): Promise<CartRecord | null> {
    const result = await this.databaseService.db.query<CartRecord>(
      `
        UPDATE carts
        SET currency_code = $3,
            exchange_rate_yer_per_unit = $4,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
          AND status IN ('open', 'abandoned')
        RETURNING id, store_id, status, currency_code, exchange_rate_yer_per_unit
      `,
      [input.storeId, input.cartId, input.currencyCode, input.exchangeRateYerPerUnit],
    );
    return result.rows[0] ?? null;
  }

  async updateCartItemQuantity(input: {
    storeId: string;
    cartId: string;
    variantId: string;
    quantity: number;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE cart_items
        SET quantity = $4,
            updated_at = NOW()
        WHERE store_id = $1
          AND cart_id = $2
          AND variant_id = $3
      `,
      [input.storeId, input.cartId, input.variantId, input.quantity],
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.touchCart(input.cartId);
      return true;
    }

    return false;
  }

  async removeCartItem(input: {
    storeId: string;
    cartId: string;
    variantId: string;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM cart_items
        WHERE store_id = $1
          AND cart_id = $2
          AND variant_id = $3
      `,
      [input.storeId, input.cartId, input.variantId],
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.touchCart(input.cartId);
      return true;
    }

    return false;
  }

  async findOrCreateCustomer(
    db: Queryable,
    input: { storeId: string; fullName: string; phone: string; email: string | null },
  ): Promise<string> {
    const existing = await db.query<{ id: string }>(
      `
        SELECT id
        FROM customers
        WHERE store_id = $1
          AND phone = $2
        LIMIT 1
      `,
      [input.storeId, input.phone],
    );

    if (existing.rows[0]?.id) {
      return existing.rows[0].id;
    }

    const created = await db.query<{ id: string }>(
      `
        INSERT INTO customers (id, store_id, full_name, phone, email)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [uuidv4(), input.storeId, input.fullName, input.phone, input.email],
    );
    return created.rows[0]!.id;
  }

  async insertCustomerAddress(
    db: Queryable,
    input: {
      storeId: string;
      customerId: string;
      addressLine: string;
      city: string | null;
      area: string | null;
      notes: string | null;
      latitude?: number | null;
      longitude?: number | null;
      mapProvider?: string | null;
      placeLabel?: string | null;
    },
  ): Promise<void> {
    const existing = await db.query<{ id: string }>(
      `
        SELECT id
        FROM customer_addresses
        WHERE customer_id = $1
          AND store_id = $2
          AND address_line = $3
          AND city IS NOT DISTINCT FROM $4
          AND area IS NOT DISTINCT FROM $5
          AND COALESCE(notes, '') = COALESCE($6::text, '')
          AND latitude IS NOT DISTINCT FROM $7
          AND longitude IS NOT DISTINCT FROM $8
          AND map_provider IS NOT DISTINCT FROM $9
          AND place_label IS NOT DISTINCT FROM $10
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `,
      [
        input.customerId,
        input.storeId,
        input.addressLine,
        input.city,
        input.area,
        input.notes,
        input.latitude ?? null,
        input.longitude ?? null,
        input.mapProvider ?? null,
        input.placeLabel ?? null,
      ],
    );

    if (existing.rows[0]?.id) {
      await this.markCustomerAddressDefault(
        db,
        input.storeId,
        input.customerId,
        existing.rows[0].id,
      );
      return;
    }

    const addressId = uuidv4();
    await db.query(
      `
        UPDATE customer_addresses
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE customer_id = $1
          AND store_id = $2
          AND is_default = TRUE
      `,
      [input.customerId, input.storeId],
    );

    await db.query(
      `
        INSERT INTO customer_addresses (
          id,
          customer_id,
          store_id,
          address_line,
          city,
          area,
          notes,
          is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      `,
      [
        addressId,
        input.customerId,
        input.storeId,
        input.addressLine,
        input.city,
        input.area,
        input.notes,
      ],
    );

    if (
      input.latitude === undefined &&
      input.longitude === undefined &&
      input.mapProvider === undefined &&
      input.placeLabel === undefined
    ) {
      return;
    }

    const locationColumns = await db.query<{ has_location_columns: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'customer_addresses'
            AND column_name IN ('latitude', 'longitude', 'map_provider', 'place_label')
          GROUP BY table_name
          HAVING COUNT(*) = 4
        ) AS has_location_columns
      `,
    );

    if (!locationColumns.rows[0]?.has_location_columns) {
      return;
    }

    await db.query(
      `
        UPDATE customer_addresses
        SET latitude = $3,
            longitude = $4,
            map_provider = $5,
            place_label = $6,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
      `,
      [
        addressId,
        input.storeId,
        input.latitude ?? null,
        input.longitude ?? null,
        input.mapProvider ?? null,
        input.placeLabel ?? null,
      ],
    );
  }

  async findCustomerAddressByIdInTransaction(
    db: Queryable,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressSummaryRow | null> {
    const result = await db.query<CustomerAddressSummaryRow>(
      `
        SELECT id, customer_id, address_line, city, area, notes, is_default,
               latitude, longitude, map_provider, place_label
        FROM customer_addresses
        WHERE store_id = $1
          AND customer_id = $2
          AND id = $3
        LIMIT 1
      `,
      [storeId, customerId, addressId],
    );
    return result.rows[0] ?? null;
  }

  private async markCustomerAddressDefault(
    db: Queryable,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<void> {
    await db.query(
      `
        UPDATE customer_addresses
        SET is_default = CASE WHEN id = $3 THEN TRUE ELSE FALSE END,
            updated_at = NOW()
        WHERE customer_id = $1
          AND store_id = $2
          AND (is_default = TRUE OR id = $3)
      `,
      [customerId, storeId, addressId],
    );
  }

  async createOrder(db: Queryable, input: CreateOrderInput): Promise<OrderRecord> {
    const result = await db.query<OrderRecord>(INSERT_ORDER_QUERY, [
      input.id,
      input.storeId,
      input.customerId,
      input.orderCode,
      input.subtotal,
      input.total,
      input.shippingZoneId,
      input.shippingMethodId ?? null,
      JSON.stringify(input.shippingMethodSnapshot ?? null),
      input.fulfillmentType ?? null,
      input.shippingFee,
      input.discountTotal,
      input.couponCode,
      input.currencyCode,
      input.exchangeRateYerPerUnit,
      input.subtotalYER,
      input.totalYER,
      input.shippingFeeYER,
      input.discountTotalYER,
      input.pointsDiscountAmountYER,
      input.note,
      JSON.stringify(input.shippingAddress),
    ]);
    return result.rows[0] as OrderRecord;
  }

  async insertOrderItem(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      productId: string;
      variantId: string;
      title: string;
      sku: string;
      unitPrice: number;
      unitPriceYER: number;
      quantity: number;
      lineTotal: number;
      lineTotalYER: number;
      attributes: Record<string, string>;
    },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO order_items (
          id,
          order_id,
          store_id,
          product_id,
          variant_id,
          title,
          sku,
          unit_price,
          unit_price_yer,
          quantity,
          line_total,
          line_total_yer,
          attributes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      `,
      [
        uuidv4(),
        input.orderId,
        input.storeId,
        input.productId,
        input.variantId,
        input.title,
        input.sku,
        input.unitPrice,
        input.unitPriceYER,
        input.quantity,
        input.lineTotal,
        input.lineTotalYER,
        JSON.stringify(input.attributes),
      ],
    );
  }

  async createPayment(
    db: Queryable,
    input: { storeId: string; orderId: string; method: PaymentMethod; amount: number },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO payments (
          id, store_id, order_id, method, status, amount, amount_yer,
          payment_method_code, payment_method_name
        )
        VALUES (
          $1, $2, $3, $4, 'pending', $5, $5, $4,
          CASE $4 WHEN 'cod' THEN 'الدفع عند الاستلام' WHEN 'transfer' THEN 'تحويل بنكي' ELSE $4 END
        )
      `,
      [uuidv4(), input.storeId, input.orderId, input.method, input.amount],
    );
  }

  async markCartCheckedOut(db: Queryable, cartId: string): Promise<void> {
    await db.query(
      `
        UPDATE carts
        SET status = 'checked_out',
            updated_at = NOW()
        WHERE id = $1
      `,
      [cartId],
    );
  }

  async insertOrderStatusHistory(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      oldStatus: string | null;
      newStatus: string;
      changedBy: string | null;
      note: string | null;
    },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO order_status_history (
          id,
          store_id,
          order_id,
          old_status,
          new_status,
          changed_by,
          note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        uuidv4(),
        input.storeId,
        input.orderId,
        input.oldStatus,
        input.newStatus,
        input.changedBy,
        input.note,
      ],
    );
  }

  async findOrderByCode(storeId: string, orderCode: string): Promise<OrderRecord | null> {
    const result = await this.databaseService.db.query<OrderRecord>(
      `
        SELECT ${ORDER_RETURNING_FIELDS}
        FROM orders
        WHERE store_id = $1
          AND order_code = $2
        LIMIT 1
      `,
      [storeId, orderCode],
    );
    return result.rows[0] ?? null;
  }

  async findCustomerPhoneByOrderId(orderId: string): Promise<string | null> {
    const result = await this.databaseService.db.query<{ phone: string }>(
      `
        SELECT c.phone
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.id = $1
        LIMIT 1
      `,
      [orderId],
    );

    return result.rows[0]?.phone ?? null;
  }

  async findOrderById(storeId: string, orderId: string): Promise<OrderRecord | null> {
    const result = await this.databaseService.db.query<OrderRecord>(
      `
        SELECT ${ORDER_RETURNING_FIELDS}
        FROM orders
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async listOrders(input: OrdersListFilters & { limit: number; offset: number }): Promise<{
    rows: OrderListRow[];
    total: number;
  }> {
    const { whereClause, values } = this.buildListFilters(input);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    const rowsResult = await this.databaseService.db.query<OrderListRow>(
      `
        SELECT
          o.id,
          o.store_id,
          o.customer_id,
          o.order_code,
          o.status,
          o.subtotal,
          o.total,
          o.shipping_zone_id,
          o.shipping_fee,
          o.discount_total,
          o.coupon_code,
          o.currency_code,
          o.note,
          o.shipping_address,
          o.created_at,
          o.updated_at,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          p.method AS payment_method,
          p.payment_method_code,
          p.payment_method_name,
          p.status AS payment_status
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      [...values, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE ${whereClause}
      `,
      values,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async listOrderStatusCounts(
    input: Omit<OrdersListFilters, 'status'>,
  ): Promise<OrderStatusCountRow[]> {
    const { whereClause, values } = this.buildListFilters(input);
    const result = await this.databaseService.db.query<OrderStatusCountRow>(
      `
        SELECT o.status, COUNT(*)::text AS count
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE ${whereClause}
        GROUP BY o.status
      `,
      values,
    );

    return result.rows;
  }

  async listOrdersForExport(input: OrdersListFilters): Promise<OrderListRow[]> {
    const { whereClause, values } = this.buildListFilters(input);
    const result = await this.databaseService.db.query<OrderListRow>(
      `
        SELECT
          o.id,
          o.store_id,
          o.customer_id,
          o.order_code,
          o.status,
          o.subtotal,
          o.total,
          o.shipping_zone_id,
          o.shipping_fee,
          o.discount_total,
          o.coupon_code,
          o.currency_code,
          o.note,
          o.shipping_address,
          o.created_at,
          o.updated_at,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          p.method AS payment_method,
          p.payment_method_code,
          p.payment_method_name,
          p.status AS payment_status
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
      `,
      values,
    );
    return result.rows;
  }

  async searchManualProducts(input: {
    storeId: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: ManualProductSearchRow[]; total: number }> {
    const q = input.q?.trim() ? input.q.trim() : null;

    const rowsResult = await this.databaseService.db.query<ManualProductSearchRow>(
      `
        SELECT
          pv.id AS variant_id,
          p.id AS product_id,
          p.title AS product_title,
          pv.title AS variant_title,
          pv.sku,
          pv.price,
          p.stock_unlimited,
          pv.stock_quantity,
          COALESCE(ir.reserved_quantity, 0) AS reserved_quantity,
          GREATEST(pv.stock_quantity - COALESCE(ir.reserved_quantity, 0), 0) AS available_quantity
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
        LEFT JOIN (
          SELECT
            variant_id,
            store_id,
            SUM(quantity)::int AS reserved_quantity
          FROM inventory_reservations
          WHERE status = 'reserved'
            AND expires_at > NOW()
          GROUP BY variant_id, store_id
        ) ir ON ir.variant_id = pv.id AND ir.store_id = pv.store_id
        WHERE pv.store_id = $1
          AND p.status = 'active'
          AND p.is_visible = TRUE
          AND p.product_type <> 'bundled'
          AND (
            $2::text IS NULL
            OR p.title ILIKE '%' || $2 || '%'
            OR pv.title ILIKE '%' || $2 || '%'
            OR pv.sku ILIKE '%' || $2 || '%'
          )
        ORDER BY p.created_at DESC, pv.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [input.storeId, q, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
        WHERE pv.store_id = $1
          AND p.status = 'active'
          AND p.is_visible = TRUE
          AND p.product_type <> 'bundled'
          AND (
            $2::text IS NULL
            OR p.title ILIKE '%' || $2 || '%'
            OR pv.title ILIKE '%' || $2 || '%'
            OR pv.sku ILIKE '%' || $2 || '%'
          )
      `,
      [input.storeId, q],
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async listOrderItems(orderId: string): Promise<OrderItemRecord[]> {
    const result = await this.databaseService.db.query<OrderItemRecord>(
      `
        SELECT id, order_id, product_id, variant_id, title, sku, unit_price, quantity, line_total, attributes
        FROM order_items
        WHERE order_id = $1
        ORDER BY created_at ASC
      `,
      [orderId],
    );
    return result.rows;
  }

  async listOrderItemsByOrderIds(orderIds: string[]): Promise<OrderItemRecord[]> {
    if (orderIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<OrderItemRecord>(
      `
        SELECT id, order_id, product_id, variant_id, title, sku, unit_price, quantity, line_total, attributes
        FROM order_items
        WHERE order_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [orderIds],
    );
    return result.rows;
  }

  async listOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryRecord[]> {
    const result = await this.databaseService.db.query<OrderStatusHistoryRecord>(
      `
        SELECT id, old_status, new_status, changed_by, note, created_at
        FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
      `,
      [orderId],
    );
    return result.rows;
  }

  async findPaymentByOrderId(orderId: string): Promise<{
    id: string;
    method: string;
    status: string;
    amount: string;
    receipt_url: string | null;
    store_payment_method_id: string | null;
    platform_payment_method_id: string | null;
    payment_method_code: string | null;
    payment_method_name: string | null;
    account_name: string | null;
    account_number: string | null;
    phone_number: string | null;
    iban: string | null;
    instructions_ar: string | null;
    instructions_en: string | null;
    payer_reference: string | null;
    payer_receipt_url: string | null;
    payer_receipt_media_asset_id: string | null;
    payer_note: string | null;
    customer_submitted_at: Date | null;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    review_note: string | null;
  } | null> {
    const result = await this.databaseService.db.query<{
      id: string;
      method: string;
      status: string;
      amount: string;
      receipt_url: string | null;
      store_payment_method_id: string | null;
      platform_payment_method_id: string | null;
      payment_method_code: string | null;
      payment_method_name: string | null;
      account_name: string | null;
      account_number: string | null;
      phone_number: string | null;
      iban: string | null;
      instructions_ar: string | null;
      instructions_en: string | null;
      payer_reference: string | null;
      payer_receipt_url: string | null;
      payer_receipt_media_asset_id: string | null;
      payer_note: string | null;
      customer_submitted_at: Date | null;
      reviewed_by: string | null;
      reviewed_at: Date | null;
      review_note: string | null;
    }>(
      `
        SELECT id, method, status, amount, receipt_url,
               store_payment_method_id, platform_payment_method_id,
               payment_method_code, payment_method_name,
               account_name, account_number, phone_number, iban,
               instructions_ar, instructions_en, payer_reference,
               payer_receipt_url, payer_receipt_media_asset_id, payer_note,
               customer_submitted_at, reviewed_by, reviewed_at, review_note
        FROM payments
        WHERE order_id = $1
        LIMIT 1
      `,
      [orderId],
    );
    return result.rows[0] ?? null;
  }

  async findCustomerById(storeId: string, customerId: string): Promise<CustomerSummaryRow | null> {
    const result = await this.databaseService.db.query<CustomerSummaryRow>(
      `
        SELECT id, full_name, phone
        FROM customers
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, customerId],
    );
    return result.rows[0] ?? null;
  }

  async findOrderListRowById(storeId: string, orderId: string): Promise<OrderListRow | null> {
    const result = await this.databaseService.db.query<OrderListRow>(
      `
        SELECT
          o.id,
          o.store_id,
          o.customer_id,
          o.order_code,
          o.status,
          o.subtotal,
          o.total,
          o.shipping_zone_id,
          o.shipping_fee,
          o.discount_total,
          o.coupon_code,
          o.currency_code,
          o.note,
          o.shipping_address,
          o.created_at,
          o.updated_at,
          c.full_name AS customer_name,
          c.phone AS customer_phone,
          p.method AS payment_method,
          p.payment_method_code,
          p.payment_method_name,
          p.status AS payment_status
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE o.store_id = $1
          AND o.id = $2
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async listCustomerAddresses(
    storeId: string,
    customerId: string,
  ): Promise<CustomerAddressSummaryRow[]> {
    const result = await this.databaseService.db.query<CustomerAddressSummaryRow>(
      `
        SELECT id, customer_id, address_line, city, area, notes, is_default
        FROM customer_addresses
        WHERE store_id = $1
          AND customer_id = $2
        ORDER BY is_default DESC, created_at DESC
      `,
      [storeId, customerId],
    );
    return result.rows;
  }

  async findCustomerAddressById(
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressSummaryRow | null> {
    const result = await this.databaseService.db.query<CustomerAddressSummaryRow>(
      `
        SELECT id, customer_id, address_line, city, area, notes, is_default
        FROM customer_addresses
        WHERE store_id = $1
          AND customer_id = $2
          AND id = $3
        LIMIT 1
      `,
      [storeId, customerId, addressId],
    );
    return result.rows[0] ?? null;
  }

  async updateOrderManual(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      customerId: string;
      subtotal: number;
      total: number;
      shippingZoneId: string | null;
      shippingMethodId: string | null;
      shippingMethodSnapshot: Record<string, unknown> | null;
      shippingFee: number;
      discountTotal: number;
      couponCode: string | null;
      note: string | null;
      shippingAddress: Record<string, unknown>;
    },
  ): Promise<void> {
    await db.query(
      `
        UPDATE orders
        SET customer_id = $3,
            subtotal = $4,
            total = $5,
            shipping_zone_id = $6,
            shipping_method_id = $7,
            shipping_method_snapshot = $8::jsonb,
            shipping_fee = $9,
            discount_total = $10,
            coupon_code = $11,
            note = $12,
            shipping_address = $13::jsonb,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
      `,
      [
        input.orderId,
        input.storeId,
        input.customerId,
        input.subtotal,
        input.total,
        input.shippingZoneId,
        input.shippingMethodId,
        JSON.stringify(input.shippingMethodSnapshot),
        input.shippingFee,
        input.discountTotal,
        input.couponCode,
        input.note,
        JSON.stringify(input.shippingAddress),
      ],
    );
  }

  async deleteOrderItems(
    db: Queryable,
    input: { storeId: string; orderId: string },
  ): Promise<void> {
    await db.query(
      `
        DELETE FROM order_items
        WHERE store_id = $1
          AND order_id = $2
      `,
      [input.storeId, input.orderId],
    );
  }

  async updateOrderPayment(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      method: PaymentMethod;
      amount: number;
    },
  ): Promise<void> {
    await db.query(
      `
        UPDATE payments
        SET method = $3,
            amount = $4,
            updated_at = NOW()
        WHERE order_id = $1
          AND store_id = $2
      `,
      [input.orderId, input.storeId, input.method, input.amount],
    );
  }

  async updateOrderStatus(
    db: Queryable,
    input: { orderId: string; storeId: string; nextStatus: OrderStatus },
  ): Promise<OrderRecord | null> {
    const result = await db.query<OrderRecord>(
      `
        UPDATE orders
        SET status = $3,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
        RETURNING ${ORDER_RETURNING_FIELDS}
      `,
      [input.orderId, input.storeId, input.nextStatus],
    );
    return result.rows[0] ?? null;
  }

  async decreaseVariantStock(
    db: Queryable,
    input: { storeId: string; variantId: string; quantity: number },
  ): Promise<boolean> {
    const result = await db.query(
      `
        UPDATE product_variants
        SET stock_quantity = stock_quantity - $3,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
          AND stock_quantity >= $3
      `,
      [input.storeId, input.variantId, input.quantity],
    );
    return (result.rowCount ?? 0) > 0;
  }
  private buildListFilters(filters: OrdersListFilters): { whereClause: string; values: unknown[] } {
    const values: unknown[] = [];
    const conditions: string[] = [];

    values.push(filters.storeId);
    conditions.push(`o.store_id = $${values.length}`);

    if (filters.status) {
      values.push(filters.status);
      conditions.push(`o.status = $${values.length}`);
    }

    const q = filters.q?.trim();
    if (q) {
      values.push(q);
      const qIndex = values.length;
      conditions.push(
        `(o.order_code ILIKE '%' || $${qIndex} || '%' OR COALESCE(c.full_name, '') ILIKE '%' || $${qIndex} || '%' OR COALESCE(c.phone, '') ILIKE '%' || $${qIndex} || '%')`,
      );
    }

    if (filters.paymentMethod) {
      values.push(filters.paymentMethod);
      conditions.push(`COALESCE(p.payment_method_code, p.method) = $${values.length}`);
    }

    if (filters.paymentStatus) {
      values.push(filters.paymentStatus);
      conditions.push(`p.status = $${values.length}`);
    }

    if (filters.dateFrom) {
      values.push(filters.dateFrom);
      conditions.push(`o.created_at >= $${values.length}`);
    }

    if (filters.dateTo) {
      values.push(filters.dateTo);
      conditions.push(`o.created_at <= $${values.length}`);
    }

    return {
      whereClause: conditions.join(' AND '),
      values,
    };
  }

  private async touchCart(cartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE carts
        SET updated_at = NOW(),
            status = 'open',
            expires_at = NOW() + INTERVAL '7 days'
        WHERE id = $1
      `,
      [cartId],
    );
  }
}
