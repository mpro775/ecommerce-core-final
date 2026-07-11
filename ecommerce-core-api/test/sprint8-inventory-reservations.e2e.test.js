require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { AccessTokenGuard } = require('../dist/auth/guards/access-token.guard');
const { AuditService } = require('../dist/audit/audit.service');
const { InventoryController } = require('../dist/inventory/inventory.controller');
const { InventoryRepository } = require('../dist/inventory/inventory.repository');
const { InventoryService } = require('../dist/inventory/inventory.service');
const { IdempotencyService } = require('../dist/idempotency/idempotency.service');
const { OutboxService } = require('../dist/messaging/outbox.service');
const { OrdersController } = require('../dist/orders/orders.controller');
const { OrdersRepository } = require('../dist/orders/orders.repository');
const { OrdersService } = require('../dist/orders/orders.service');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');
const { AttributesService } = require('../dist/attributes/attributes.service');
const { CategoriesRepository } = require('../dist/categories/categories.repository');
const { AbandonedCartsService } = require('../dist/customers/abandoned-carts.service');
const { CustomerEngagementService } = require('../dist/customers/customer-engagement.service');
const { CustomersService } = require('../dist/customers/customers.service');
const { FiltersService } = require('../dist/filters/filters.service');
const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
const { ProductsRepository } = require('../dist/products/products.repository');
const { PromotionsService } = require('../dist/promotions/promotions.service');
const { SaasService } = require('../dist/saas/saas.service');
const { ShippingRepository } = require('../dist/shipping/shipping.repository');
const { StoreResolverService } = require('../dist/storefront/store-resolver.service');
const { StorefrontController } = require('../dist/storefront/storefront.controller');
const { StorefrontTrackingService } = require('../dist/storefront/storefront-tracking.service');
const { StorefrontService } = require('../dist/storefront/storefront.service');
const { StoresRepository } = require('../dist/stores/stores.repository');
const { TenantGuard } = require('../dist/tenancy/guards/tenant.guard');
const { ThemesService } = require('../dist/themes/themes.service');
const { WebhooksService } = require('../dist/webhooks/webhooks.service');
const { AffiliatesService } = require('../dist/affiliates/affiliates.service');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const CART_ID = '44444444-4444-4444-8444-444444444444';
const ACTIVE_USER = {
  id: '55555555-5555-4555-8555-555555555555',
  storeId: STORE_ID,
  email: 'owner@example.com',
  fullName: 'Store Owner',
  role: 'owner',
  permissions: ['*'],
  sessionId: '66666666-6666-4666-8666-666666666666',
};

const state = {
  orders: new Map(),
  orderItemsByOrderId: new Map(),
  orderStatusHistoryByOrderId: new Map(),
  reservationsByKey: new Map(),
  movements: [],
  variants: new Map(),
  outboxEvents: [],
  cart: {
    id: CART_ID,
    store_id: STORE_ID,
    status: 'open',
    currency_code: 'SAR',
  },
  cartItems: [],
};

const nowIso = () => new Date().toISOString();
const reservationKey = (storeId, orderId, variantId) => `${storeId}:${orderId}:${variantId}`;

const inventoryRepositoryMock = {
  async withTransaction(callback) {
    return callback({ query: async () => ({ rows: [], rowCount: 0 }) });
  },

  async releaseExpiredReservations(_db, storeId) {
    let released = 0;
    const now = Date.now();
    for (const reservation of state.reservationsByKey.values()) {
      if (
        reservation.store_id === storeId &&
        reservation.status === 'reserved' &&
        reservation.expires_at.getTime() <= now
      ) {
        reservation.status = 'released';
        reservation.released_at = new Date();
        reservation.release_reason = 'expired';
        reservation.updated_at = new Date();
        released += 1;
      }
    }
    return released;
  },

  async reserveVariant(_db, input) {
    const variant = state.variants.get(input.variantId);
    if (!variant || variant.store_id !== input.storeId) {
      return false;
    }

    let activeReserved = 0;
    const now = Date.now();
    for (const reservation of state.reservationsByKey.values()) {
      if (
        reservation.store_id === input.storeId &&
        reservation.variant_id === input.variantId &&
        reservation.status === 'reserved' &&
        reservation.expires_at.getTime() > now
      ) {
        activeReserved += reservation.quantity;
      }
    }

    if (variant.stock_quantity - activeReserved < input.quantity) {
      return false;
    }

    const key = reservationKey(input.storeId, input.orderId, input.variantId);
    const existing = state.reservationsByKey.get(key);
    if (existing?.status === 'consumed') {
      return false;
    }

    const next = {
      id: existing?.id ?? randomUUID(),
      store_id: input.storeId,
      order_id: input.orderId,
      variant_id: input.variantId,
      quantity: input.quantity,
      status: 'reserved',
      reserved_at: new Date(),
      expires_at: input.expiresAt,
      released_at: null,
      consumed_at: null,
      release_reason: null,
      metadata: input.metadata ?? {},
      updated_at: new Date(),
    };

    state.reservationsByKey.set(key, next);
    return true;
  },

  async consumeReservation(_db, input) {
    const key = reservationKey(input.storeId, input.orderId, input.variantId);
    const reservation = state.reservationsByKey.get(key);
    if (!reservation) {
      return false;
    }
    if (reservation.status !== 'reserved') {
      return false;
    }
    if (reservation.quantity !== input.quantity) {
      return false;
    }
    if (reservation.expires_at.getTime() <= Date.now()) {
      return false;
    }

    reservation.status = 'consumed';
    reservation.consumed_at = new Date();
    reservation.updated_at = new Date();
    state.reservationsByKey.set(key, reservation);
    return true;
  },

  async releaseOrderReservations(_db, input) {
    let released = 0;
    for (const reservation of state.reservationsByKey.values()) {
      if (
        reservation.store_id === input.storeId &&
        reservation.order_id === input.orderId &&
        reservation.status === 'reserved'
      ) {
        reservation.status = 'released';
        reservation.released_at = new Date();
        reservation.release_reason = input.reason;
        reservation.updated_at = new Date();
        released += 1;
      }
    }
    return released;
  },

  async decreaseVariantStock(_db, input) {
    const variant = state.variants.get(input.variantId);
    if (!variant || variant.store_id !== input.storeId || variant.stock_quantity < input.quantity) {
      return null;
    }

    const previous = variant.stock_quantity;
    variant.stock_quantity -= input.quantity;
    state.variants.set(input.variantId, variant);

    return {
      variant_id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      low_stock_threshold: variant.low_stock_threshold,
      previous_stock_quantity: previous,
      current_stock_quantity: variant.stock_quantity,
    };
  },

  async increaseVariantStock(_db, input) {
    const variant = state.variants.get(input.variantId);
    if (!variant || variant.store_id !== input.storeId) {
      return null;
    }

    const previous = variant.stock_quantity;
    variant.stock_quantity += input.quantity;
    state.variants.set(input.variantId, variant);

    return {
      variant_id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      low_stock_threshold: variant.low_stock_threshold,
      previous_stock_quantity: previous,
      current_stock_quantity: variant.stock_quantity,
    };
  },

  async updateVariantLowStockThreshold(_db, input) {
    const variant = state.variants.get(input.variantId);
    if (!variant || variant.store_id !== input.storeId) {
      return null;
    }
    variant.low_stock_threshold = input.lowStockThreshold;
    state.variants.set(input.variantId, variant);
    return this.findVariantInventorySnapshot(
      { query: async () => ({ rows: [], rowCount: 0 }) },
      input.storeId,
      input.variantId,
    );
  },

  async createMovement(_db, input) {
    const variant = state.variants.get(input.variantId);
    state.movements.push({
      id: randomUUID(),
      store_id: input.storeId,
      variant_id: input.variantId,
      order_id: input.orderId,
      movement_type: input.movementType,
      qty_delta: input.qtyDelta,
      note: input.note,
      metadata: input.metadata ?? {},
      created_by: input.createdBy,
      created_at: new Date(),
      product_id: variant.product_id,
      product_title: variant.product_title,
      variant_title: variant.variant_title,
      sku: variant.sku,
    });
  },

  async findVariantInventorySnapshot(_db, storeId, variantId) {
    const variant = state.variants.get(variantId);
    if (!variant || variant.store_id !== storeId) {
      return null;
    }

    let reservedQuantity = 0;
    for (const reservation of state.reservationsByKey.values()) {
      if (
        reservation.store_id === storeId &&
        reservation.variant_id === variantId &&
        reservation.status === 'reserved' &&
        reservation.expires_at.getTime() > Date.now()
      ) {
        reservedQuantity += reservation.quantity;
      }
    }

    return {
      variant_id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      product_title: variant.product_title,
      variant_title: variant.variant_title,
      stock_quantity: variant.stock_quantity,
      low_stock_threshold: variant.low_stock_threshold,
      reserved_quantity: reservedQuantity,
      available_quantity: Math.max(variant.stock_quantity - reservedQuantity, 0),
    };
  },

  async findVariantAvailableQuantity(storeId, variantId) {
    const snapshot = await this.findVariantInventorySnapshot(
      { query: async () => ({ rows: [], rowCount: 0 }) },
      storeId,
      variantId,
    );
    return snapshot ? snapshot.available_quantity : null;
  },

  async listMovements(input) {
    const rows = state.movements
      .filter((row) => row.store_id === input.storeId)
      .filter((row) => !input.variantId || row.variant_id === input.variantId)
      .filter((row) => !input.orderId || row.order_id === input.orderId)
      .filter((row) => !input.movementType || row.movement_type === input.movementType)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return {
      rows: rows.slice(input.offset, input.offset + input.limit),
      total: rows.length,
    };
  },

  async listReservations(input) {
    const rows = [...state.reservationsByKey.values()]
      .filter((row) => row.store_id === input.storeId)
      .filter((row) => !input.status || row.status === input.status)
      .filter((row) => !input.variantId || row.variant_id === input.variantId)
      .filter((row) => !input.orderId || row.order_id === input.orderId)
      .map((row) => {
        const variant = state.variants.get(row.variant_id);
        return {
          ...row,
          product_id: variant.product_id,
          product_title: variant.product_title,
          variant_title: variant.variant_title,
          sku: variant.sku,
        };
      })
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    return {
      rows: rows.slice(input.offset, input.offset + input.limit),
      total: rows.length,
    };
  },

  async listLowStockVariants(storeId) {
    const rows = [];
    for (const variant of state.variants.values()) {
      if (variant.store_id !== storeId) {
        continue;
      }
      if (
        variant.low_stock_threshold <= 0 ||
        variant.stock_quantity > variant.low_stock_threshold
      ) {
        continue;
      }

      const snapshot = await this.findVariantInventorySnapshot(
        { query: async () => ({ rows: [], rowCount: 0 }) },
        storeId,
        variant.id,
      );
      if (snapshot) {
        rows.push(snapshot);
      }
    }
    return rows;
  },

  async listReservedVariantsForOrder(_db, storeId, orderId) {
    const rows = [];
    const now = Date.now();
    for (const reservation of state.reservationsByKey.values()) {
      if (
        reservation.store_id !== storeId ||
        reservation.order_id !== orderId ||
        reservation.status !== 'reserved' ||
        reservation.expires_at.getTime() <= now
      ) {
        continue;
      }
      const variant = state.variants.get(reservation.variant_id);
      if (!variant) {
        continue;
      }
      rows.push({
        variant_id: reservation.variant_id,
        quantity: reservation.quantity,
        sku: variant.sku,
      });
    }
    return rows;
  },

  async countOrderReservations(_db, storeId, orderId) {
    let count = 0;
    for (const reservation of state.reservationsByKey.values()) {
      if (reservation.store_id === storeId && reservation.order_id === orderId) {
        count += 1;
      }
    }
    return count;
  },

  async listVariantWarehouseStocksForUpdate() {
    return [];
  },
};

const ordersRepositoryMock = {
  async findOpenCartById(storeId, cartId) {
    if (storeId !== STORE_ID || cartId !== CART_ID || state.cart.status !== 'open') {
      return null;
    }
    return state.cart;
  },

  async listCartItems(storeId, cartId) {
    if (storeId !== STORE_ID || cartId !== CART_ID) {
      return [];
    }
    return state.cartItems;
  },

  async withTransaction(callback) {
    return callback({ query: async () => ({ rows: [], rowCount: 0 }) });
  },

  async findOrCreateCustomer() {
    return randomUUID();
  },

  async insertCustomerAddress() {
    return;
  },

  async createOrder(_db, input) {
    const order = {
      id: input.id,
      store_id: input.storeId,
      customer_id: input.customerId,
      order_code: input.orderCode,
      status: 'new',
      subtotal: input.subtotal.toFixed(2),
      total: input.total.toFixed(2),
      shipping_zone_id: input.shippingZoneId,
      shipping_fee: input.shippingFee.toFixed(2),
      discount_total: input.discountTotal.toFixed(2),
      coupon_code: input.couponCode,
      currency_code: input.currencyCode,
      note: input.note,
      shipping_address: input.shippingAddress,
      created_at: new Date(),
      updated_at: new Date(),
    };
    state.orders.set(order.id, order);
    state.orderItemsByOrderId.set(order.id, []);
    state.orderStatusHistoryByOrderId.set(order.id, []);
    return order;
  },

  async insertOrderItem(_db, input) {
    const rows = state.orderItemsByOrderId.get(input.orderId) ?? [];
    rows.push({
      id: randomUUID(),
      order_id: input.orderId,
      product_id: input.productId,
      variant_id: input.variantId,
      title: input.title,
      sku: input.sku,
      unit_price: input.unitPrice.toFixed(2),
      quantity: input.quantity,
      line_total: input.lineTotal.toFixed(2),
      attributes: input.attributes,
    });
    state.orderItemsByOrderId.set(input.orderId, rows);
  },

  async createPayment() {
    return;
  },

  async insertOrderStatusHistory(_db, input) {
    const rows = state.orderStatusHistoryByOrderId.get(input.orderId) ?? [];
    rows.push({
      id: randomUUID(),
      old_status: input.oldStatus,
      new_status: input.newStatus,
      changed_by: input.changedBy,
      note: input.note,
      created_at: new Date(),
    });
    state.orderStatusHistoryByOrderId.set(input.orderId, rows);
  },

  async markCartCheckedOut() {
    state.cart = { ...state.cart, status: 'checked_out' };
  },

  async findOrderByCode(storeId, orderCode) {
    return (
      [...state.orders.values()].find(
        (order) => order.store_id === storeId && order.order_code === orderCode,
      ) ?? null
    );
  },

  async findCustomerPhoneByOrderId() {
    return '+966500000000';
  },

  async findOrderById(storeId, orderId) {
    const row = state.orders.get(orderId);
    return row && row.store_id === storeId ? row : null;
  },

  async listOrders() {
    return { rows: [...state.orders.values()], total: state.orders.size };
  },

  async listOrderItems(orderId) {
    return state.orderItemsByOrderId.get(orderId) ?? [];
  },

  async listOrderStatusHistory(orderId) {
    return state.orderStatusHistoryByOrderId.get(orderId) ?? [];
  },

  async findPaymentByOrderId() {
    return null;
  },

  async findOrderListRowById() {
    return null;
  },

  async updateOrderStatus(_db, input) {
    const order = state.orders.get(input.orderId);
    if (!order || order.store_id !== input.storeId) {
      return null;
    }
    const updated = {
      ...order,
      status: input.nextStatus,
      updated_at: new Date(),
    };
    state.orders.set(order.id, updated);
    return updated;
  },
};

const storeResolverMock = {
  async resolve() {
    return {
      id: STORE_ID,
      slug: 'demo-store',
      name: 'Demo Store',
      logo_url: null,
      currency_code: 'SAR',
      is_suspended: false,
    };
  },
};

const auditServiceMock = {
  async log() {
    return;
  },
};

const outboxServiceMock = {
  async enqueue(event) {
    state.outboxEvents.push({ eventType: event.eventType, payload: event.payload });
    return randomUUID();
  },
};

const noopServices = {
  async assertMetricCanGrow() {
    return;
  },
  async recordUsageEvent() {
    return;
  },
  async computeCheckoutDiscount() {
    return { totalDiscount: 0, couponId: null, couponCode: null };
  },
};

const filtersServiceMock = {
  async listStorefrontFilters() {
    return [];
  },
};

const customersServiceMock = {
  async verifyAccessToken() {
    throw new Error('invalid token');
  },
};

const customerEngagementServiceMock = {
  async attachRestockConversion() {
    return false;
  },
  async trackRestockClickAndBuildRedirect() {
    throw new Error('not implemented');
  },
};

const abandonedCartsServiceMock = {
  async resolveRecoveryRedirect() {
    throw new Error('invalid token');
  },
  async trackRecoveryEmailOpen() {
    return;
  },
  async attachRecoveredCheckout() {
    return false;
  },
};

const storefrontTrackingServiceMock = {
  async trackEvent() {
    return;
  },
  resolveSessionIdForRequest() {
    return ACTIVE_USER.sessionId;
  },
};

const loyaltyServiceMock = {
  async getWalletForCurrentCustomer() {
    return { availablePoints: 0 };
  },
  async getSettingsByStoreId() {
    return {
      isEnabled: false,
      redeemRatePoints: 100,
      redeemRateAmount: 1,
      minRedeemPoints: 100,
      redeemStepPoints: 10,
      maxDiscountPercent: 100,
    };
  },
  computeRedeemEstimate() {
    return { pointsRedeemed: 0, discountAmount: 0 };
  },
  async getRulesByStoreId() {
    return [];
  },
  async applyRedemptionToOrderInTransaction() {
    return;
  },
  async handleOrderCompletedInTransaction() {
    return;
  },
  async handleOrderCancelledOrReturnedInTransaction() {
    return;
  },
  async publishWalletUpdated() {
    return;
  },
};

const affiliatesServiceMock = {
  async resolveCheckoutAttribution() {
    return null;
  },
  async createPendingCommissionInTransaction() {
    return;
  },
  async handleOrderStatusChangedInTransaction() {
    return;
  },
};

const idempotencyServiceMock = {
  async checkOrPrepare() {
    return { isCached: false, record: null };
  },
  async storeResponse() {
    return;
  },
};

const webhooksServiceMock = {
  async dispatchEvent() {
    return 0;
  },
};

describe('Sprint 8 inventory reservations e2e', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StorefrontController, OrdersController, InventoryController],
      providers: [
        StorefrontService,
        OrdersService,
        InventoryService,
        { provide: InventoryRepository, useValue: inventoryRepositoryMock },
        { provide: OrdersRepository, useValue: ordersRepositoryMock },
        { provide: StoreResolverService, useValue: storeResolverMock },
        {
          provide: StoresRepository,
          useValue: {
            findById: async () => ({
              id: STORE_ID,
              name: 'Demo Store',
              slug: 'demo-store',
              logo_url: null,
              phone: null,
              address: null,
              currency_code: 'SAR',
              timezone: 'Asia/Riyadh',
              shipping_policy: null,
              return_policy: null,
              privacy_policy: null,
              terms_of_service: null,
            }),
          },
        },
        { provide: IdempotencyService, useValue: idempotencyServiceMock },
        {
          provide: CategoriesRepository,
          useValue: { listActive: async () => [], findBySlug: async () => null },
        },
        { provide: FiltersService, useValue: filtersServiceMock },
        {
          provide: AttributesService,
          useValue: { listStorefrontFilterAttributes: async () => [] },
        },
        {
          provide: ProductsRepository,
          useValue: {
            list: async () => ({ rows: [], total: 0 }),
            listVariants: async () => [],
            listProductImages: async () => [],
            findBySlug: async () => null,
          },
        },
        {
          provide: ShippingRepository,
          useValue: { list: async () => [], findActiveById: async () => null },
        },
        { provide: PromotionsService, useValue: noopServices },
        { provide: SaasService, useValue: noopServices },
        { provide: WebhooksService, useValue: webhooksServiceMock },
        { provide: CustomersService, useValue: customersServiceMock },
        { provide: CustomerEngagementService, useValue: customerEngagementServiceMock },
        { provide: AbandonedCartsService, useValue: abandonedCartsServiceMock },
        { provide: StorefrontTrackingService, useValue: storefrontTrackingServiceMock },
        { provide: LoyaltyService, useValue: loyaltyServiceMock },
        { provide: AffiliatesService, useValue: affiliatesServiceMock },
        {
          provide: ThemesService,
          useValue: {
            getStorefrontTheme: async () => ({ mode: 'published', version: 1, config: {} }),
          },
        },
        { provide: OutboxService, useValue: outboxServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context) {
          const request = context.switchToHttp().getRequest();
          request.user = ACTIVE_USER;
          request.storeId = ACTIVE_USER.storeId;
          return true;
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    state.orders.clear();
    state.orderItemsByOrderId.clear();
    state.orderStatusHistoryByOrderId.clear();
    state.reservationsByKey.clear();
    state.movements.length = 0;
    state.outboxEvents.length = 0;
    state.cart = {
      id: CART_ID,
      store_id: STORE_ID,
      status: 'open',
      currency_code: 'SAR',
    };
    state.cartItems = [
      {
        cart_item_id: randomUUID(),
        product_id: PRODUCT_ID,
        category_id: null,
        variant_id: VARIANT_ID,
        quantity: 2,
        unit_price: '50.00',
        stock_quantity: 10,
        product_title: 'Sport T-Shirt',
        sku: 'TS-RED-M',
        attributes: { color: 'red', size: 'm' },
      },
    ];
    state.variants.clear();
    state.variants.set(VARIANT_ID, {
      id: VARIANT_ID,
      store_id: STORE_ID,
      product_id: PRODUCT_ID,
      product_title: 'Sport T-Shirt',
      variant_title: 'Red / M',
      sku: 'TS-RED-M',
      stock_quantity: 10,
      low_stock_threshold: 9,
    });
  });

  after(async () => {
    await app.close();
  });

  it('creates checkout reservations then consumes them on order confirmation', async () => {
    const checkout = await requestJson(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: CART_ID,
          customerName: 'Ahmad Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmad@example.com',
          addressLine: 'Main Street 1',
          city: 'Riyadh',
          area: 'North',
          paymentMethod: 'cod',
        }),
      },
      200,
      baseUrl,
    );

    const reservationsAfterCheckout = await requestJson(
      '/inventory/reservations?status=reserved',
      { method: 'GET', headers: authHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(reservationsAfterCheckout.items.length, 1);
    assert.equal(reservationsAfterCheckout.items[0].quantity, 2);

    const confirmed = await requestJson(
      `/orders/${checkout.orderId}/status`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'confirmed' }),
      },
      200,
      baseUrl,
    );
    assert.equal(confirmed.status, 'confirmed');

    const reservationsAfterConfirm = await requestJson(
      `/inventory/reservations?orderId=${checkout.orderId}`,
      { method: 'GET', headers: authHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(reservationsAfterConfirm.items.length, 1);
    assert.equal(reservationsAfterConfirm.items[0].status, 'consumed');

    const movements = await requestJson(
      `/inventory/movements?orderId=${checkout.orderId}`,
      { method: 'GET', headers: authHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(movements.items.length, 1);
    assert.equal(movements.items[0].movementType, 'sale');
    assert.equal(movements.items[0].qtyDelta, -2);

    const lowStockEvents = state.outboxEvents.filter(
      (event) => event.eventType === 'inventory.low_stock',
    );
    assert.equal(lowStockEvents.length, 1);
    assert.equal(lowStockEvents[0].payload.variantId, VARIANT_ID);
  });

  it('releases reservations when a new order is cancelled', async () => {
    const checkout = await requestJson(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: CART_ID,
          customerName: 'Saeed Ahmad',
          customerPhone: '+966511111111',
          customerEmail: 'saeed@example.com',
          addressLine: 'Market Road 9',
          city: 'Riyadh',
          area: 'West',
          paymentMethod: 'cod',
        }),
      },
      200,
      baseUrl,
    );

    await requestJson(
      `/orders/${checkout.orderId}/status`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'cancelled', note: 'Customer requested cancel' }),
      },
      200,
      baseUrl,
    );

    const reservations = await requestJson(
      `/inventory/reservations?orderId=${checkout.orderId}`,
      { method: 'GET', headers: authHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(reservations.items.length, 1);
    assert.equal(reservations.items[0].status, 'released');
    assert.equal(reservations.items[0].releaseReason, 'order_cancelled');

    const movements = await requestJson(
      `/inventory/movements?orderId=${checkout.orderId}`,
      { method: 'GET', headers: authHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(movements.items.length, 0);
  });
});

function authHeaders(withBody = true) {
  const headers = {
    authorization: 'Bearer sprint8-token',
    'x-store-id': STORE_ID,
  };

  if (withBody) {
    headers['content-type'] = 'application/json';
  }

  return headers;
}

async function requestJson(path, init, expectedStatus, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (response.status !== expectedStatus) {
    const errorBody = await response.text();
    assert.equal(
      response.status,
      expectedStatus,
      `Expected ${expectedStatus} for ${path} but got ${response.status}. Body: ${errorBody}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
