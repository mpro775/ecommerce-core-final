require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { BadRequestException, NotFoundException, ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { AccessTokenGuard } = require('../dist/auth/guards/access-token.guard');
const { AdvancedOffersService } = require('../dist/advanced-offers/advanced-offers.service');
const { AttributesService } = require('../dist/attributes/attributes.service');
const { AuditService } = require('../dist/audit/audit.service');
const { InventoryService } = require('../dist/inventory/inventory.service');
const { IdempotencyService } = require('../dist/idempotency/idempotency.service');
const { OutboxService } = require('../dist/messaging/outbox.service');
const { OrdersRepository } = require('../dist/orders/orders.repository');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');
const { PromotionsController } = require('../dist/promotions/promotions.controller');
const { PromotionsRepository } = require('../dist/promotions/promotions.repository');
const { PromotionsService } = require('../dist/promotions/promotions.service');
const { CategoriesRepository } = require('../dist/categories/categories.repository');
const { AbandonedCartsService } = require('../dist/customers/abandoned-carts.service');
const { CustomerEngagementService } = require('../dist/customers/customer-engagement.service');
const { CustomersService } = require('../dist/customers/customers.service');
const { FiltersService } = require('../dist/filters/filters.service');
const { ProductsRepository } = require('../dist/products/products.repository');
const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
const { ShippingController } = require('../dist/shipping/shipping.controller');
const { ShippingCalculatorService } = require('../dist/shipping/shipping-calculator.service');
const { ShippingRepository } = require('../dist/shipping/shipping.repository');
const { ShippingService } = require('../dist/shipping/shipping.service');
const { StoreResolverService } = require('../dist/storefront/store-resolver.service');
const { StorefrontController } = require('../dist/storefront/storefront.controller');
const { StorefrontTrackingService } = require('../dist/storefront/storefront-tracking.service');
const { StorefrontService } = require('../dist/storefront/storefront.service');
const { StoresRepository } = require('../dist/stores/stores.repository');
const { TenantGuard } = require('../dist/tenancy/guards/tenant.guard');
const { SaasService } = require('../dist/saas/saas.service');
const { ThemesService } = require('../dist/themes/themes.service');
const { WebhooksService } = require('../dist/webhooks/webhooks.service');
const { AffiliatesService } = require('../dist/affiliates/affiliates.service');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const OPEN_CART_ID = '0b2cc32f-b97f-4d84-8b53-0a162f17c0fc';
const ACTIVE_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  storeId: STORE_ID,
  email: 'owner@example.com',
  fullName: 'Store Owner',
  role: 'owner',
  permissions: ['*'],
  sessionId: '33333333-3333-4333-8333-333333333333',
};

const state = {
  shippingZones: new Map(),
  coupons: new Map(),
  outboxEvents: [],
  cartItems: [],
  checkedOutCartIds: new Set(),
  recoveryTokens: new Map(),
  openedRecoveryTokens: new Set(),
  clickedRecoveryTokens: new Set(),
  recoveredCheckouts: [],
};

const staticCart = {
  id: OPEN_CART_ID,
  store_id: STORE_ID,
  status: 'open',
  currency_code: 'SAR',
};

function createDefaultCartItems() {
  return [
    {
      cart_item_id: randomUUID(),
      product_id: randomUUID(),
      category_id: null,
      variant_id: randomUUID(),
      quantity: 2,
      unit_price: '100.00',
      stock_quantity: 10,
      product_title: 'Smoke Test Product',
      sku: 'SMOKE-1',
      attributes: {},
    },
  ];
}

const shippingRepositoryMock = {
  async create(input) {
    const zone = {
      id: randomUUID(),
      store_id: input.storeId,
      name: input.name,
      city: input.city,
      area: input.area,
      description: input.description ?? null,
      fee: input.fee.toFixed(2),
      is_active: input.isActive,
    };
    state.shippingZones.set(zone.id, zone);
    return zone;
  },
  async list(storeId, q) {
    const query = q?.toLowerCase();
    return [...state.shippingZones.values()].filter((zone) => {
      if (zone.store_id !== storeId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        zone.name.toLowerCase().includes(query) ||
        (zone.city ?? '').toLowerCase().includes(query) ||
        (zone.area ?? '').toLowerCase().includes(query)
      );
    });
  },
  async findById(storeId, zoneId) {
    const zone = state.shippingZones.get(zoneId);
    return zone && zone.store_id === storeId ? zone : null;
  },
  async findActiveById(storeId, zoneId) {
    const zone = state.shippingZones.get(zoneId);
    if (!zone || zone.store_id !== storeId || !zone.is_active) {
      return null;
    }
    return zone;
  },
  async update(input) {
    const existing = state.shippingZones.get(input.zoneId);
    if (!existing || existing.store_id !== input.storeId) {
      return null;
    }

    const updated = {
      ...existing,
      name: input.name,
      city: input.city,
      area: input.area,
      description: input.description ?? existing.description ?? null,
      fee: input.fee.toFixed(2),
      is_active: input.isActive,
    };
    state.shippingZones.set(input.zoneId, updated);
    return updated;
  },
  async listMethodsByZone() {
    return [];
  },
  async delete(storeId, zoneId) {
    const existing = state.shippingZones.get(zoneId);
    if (!existing || existing.store_id !== storeId) {
      return false;
    }
    state.shippingZones.delete(zoneId);
    return true;
  },
};

const promotionsRepositoryMock = {
  async createCoupon(input) {
    const coupon = {
      id: randomUUID(),
      store_id: input.storeId,
      code: input.code,
      discount_type: input.discountType,
      discount_value: input.discountValue.toFixed(2),
      min_order_amount: input.minOrderAmount.toFixed(2),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      max_uses: input.maxUses,
      used_count: 0,
      is_active: true,
      is_free_shipping: input.isFreeShipping ?? false,
    };
    state.coupons.set(coupon.code, coupon);
    return coupon;
  },
  async listCoupons(storeId, q) {
    const query = q?.toLowerCase();
    return [...state.coupons.values()].filter(
      (coupon) =>
        coupon.store_id === storeId && (!query || coupon.code.toLowerCase().includes(query)),
    );
  },
  async findCouponById(storeId, couponId) {
    return (
      [...state.coupons.values()].find(
        (coupon) => coupon.store_id === storeId && coupon.id === couponId,
      ) ?? null
    );
  },
  async findCouponByCode(storeId, code) {
    const normalized = code.trim().toUpperCase();
    const coupon = state.coupons.get(normalized);
    return coupon && coupon.store_id === storeId ? coupon : null;
  },
  async updateCoupon(input) {
    const existing = [...state.coupons.values()].find(
      (coupon) => coupon.store_id === input.storeId && coupon.id === input.couponId,
    );
    if (!existing) {
      return null;
    }

    state.coupons.delete(existing.code);
    const updated = {
      ...existing,
      code: input.code,
      discount_type: input.discountType,
      discount_value: input.discountValue.toFixed(2),
      min_order_amount: input.minOrderAmount.toFixed(2),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      max_uses: input.maxUses,
      is_active: input.isActive,
      is_free_shipping: input.isFreeShipping ?? existing.is_free_shipping ?? false,
    };
    state.coupons.set(updated.code, updated);
    return updated;
  },
  async createOffer() {
    throw new Error('Not needed in smoke tests');
  },
  async listOffers() {
    return [];
  },
  async findOfferById() {
    return null;
  },
  async updateOffer() {
    return null;
  },
  async listActiveOffers() {
    return [];
  },
  async listActiveInlineProductOffers() {
    return [];
  },
  calculateBestOfferDiscount() {
    return { offerId: null, discount: 0 };
  },
  calculateDiscount(discountValue, discountType, subtotal) {
    if (discountType === 'percent') {
      return Number(Math.min(subtotal, (subtotal * discountValue) / 100).toFixed(2));
    }
    return Number(Math.min(subtotal, discountValue).toFixed(2));
  },
  async incrementCouponUsage(_db, storeId, couponId) {
    const coupon = [...state.coupons.values()].find(
      (entry) => entry.store_id === storeId && entry.id === couponId,
    );
    if (!coupon) {
      return false;
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return false;
    }
    coupon.used_count += 1;
    return true;
  },
};

const ordersRepositoryMock = {
  async findOpenCartById(storeId, cartId) {
    if (state.checkedOutCartIds.has(cartId)) {
      return null;
    }
    if (storeId === STORE_ID && cartId === OPEN_CART_ID) {
      return staticCart;
    }
    return null;
  },
  async listCartItems(storeId, cartId) {
    if (storeId === STORE_ID && cartId === OPEN_CART_ID) {
      return state.cartItems;
    }
    return [];
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
    return {
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
  },
  async insertOrderItem() {
    return;
  },
  async createPayment() {
    return;
  },
  async insertOrderStatusHistory() {
    return;
  },
  async markCartCheckedOut() {
    state.checkedOutCartIds.add(OPEN_CART_ID);
    return;
  },
};

const storeResolverMock = {
  async resolve() {
    return {
      id: STORE_ID,
      slug: 'demo',
      name: 'Demo Store',
      logo_url: null,
      currency_code: 'SAR',
      domain: null,
      is_active: true,
    };
  },
};

const categoriesRepositoryMock = {
  async listActive() {
    return [];
  },
  async findBySlug() {
    return null;
  },
};

const attributesServiceMock = {
  async listStorefrontFilterAttributes() {
    return [];
  },
};

const inventoryServiceMock = {
  async releaseExpiredReservations() {
    return 0;
  },
  async getAvailableStock(_storeId, _variantId) {
    return 10;
  },
  async reserveOrderItems() {
    return;
  },
  async publishLowStockAlerts() {
    return;
  },
};

const outboxServiceMock = {
  async enqueue(event) {
    state.outboxEvents.push({
      eventType: event.eventType,
      payload: event.payload,
    });
  },
};

const themesServiceMock = {
  async getStorefrontTheme(storeId) {
    return {
      storeId,
      mode: 'published',
      version: 1,
      config: {},
    };
  },
};

const saasServiceMock = {
  async assertMetricCanGrow() {
    return;
  },
  async recordUsageEvent() {
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

const customersServiceMock = {
  async verifyAccessToken() {
    throw new Error('invalid token');
  },
};

const filtersServiceMock = {
  async listStorefrontFilters() {
    return [];
  },
};

const customerEngagementServiceMock = {
  async attachRestockConversion() {
    return false;
  },
  async trackRestockClickAndBuildRedirect() {
    throw new NotFoundException('Restock token is invalid');
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

const abandonedCartsServiceMock = {
  async resolveRecoveryRedirect(token) {
    const row = state.recoveryTokens.get(String(token));
    if (!row) {
      throw new NotFoundException('Recovery link is invalid');
    }
    if (row.expired) {
      throw new BadRequestException('Recovery link has expired');
    }
    state.clickedRecoveryTokens.add(String(token));
    return {
      redirectUrl: row.redirectUrl,
      cartId: row.cartId,
    };
  },
  async trackRecoveryEmailOpen(token) {
    const normalized = String(token);
    if (state.recoveryTokens.has(normalized)) {
      state.openedRecoveryTokens.add(normalized);
    }
  },
  async attachRecoveredCheckout(input) {
    state.recoveredCheckouts.push({
      storeId: input.storeId,
      cartId: input.cartId,
      orderId: input.orderId,
    });
    return true;
  },
};

const advancedOffersServiceMock = {
  async computeBestDiscount() {
    return { offerId: null, discount: 0 };
  },
};

const affiliatesServiceMock = {
  async resolveCheckoutAttribution() {
    return null;
  },
  async createPendingCommissionInTransaction() {
    return;
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
};

const auditServiceMock = {
  async log() {
    return;
  },
};

describe('Sprint 4 API smoke e2e', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShippingController, PromotionsController, StorefrontController],
      providers: [
        ShippingService,
        ShippingCalculatorService,
        PromotionsService,
        StorefrontService,
        { provide: ShippingRepository, useValue: shippingRepositoryMock },
        { provide: PromotionsRepository, useValue: promotionsRepositoryMock },
        { provide: OrdersRepository, useValue: ordersRepositoryMock },
        { provide: CategoriesRepository, useValue: categoriesRepositoryMock },
        { provide: FiltersService, useValue: filtersServiceMock },
        { provide: AttributesService, useValue: attributesServiceMock },
        { provide: InventoryService, useValue: inventoryServiceMock },
        { provide: ProductsRepository, useValue: {} },
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
        { provide: SaasService, useValue: saasServiceMock },
        { provide: ThemesService, useValue: themesServiceMock },
        { provide: WebhooksService, useValue: webhooksServiceMock },
        { provide: CustomersService, useValue: customersServiceMock },
        { provide: CustomerEngagementService, useValue: customerEngagementServiceMock },
        { provide: AbandonedCartsService, useValue: abandonedCartsServiceMock },
        { provide: StorefrontTrackingService, useValue: storefrontTrackingServiceMock },
        { provide: LoyaltyService, useValue: loyaltyServiceMock },
        { provide: AdvancedOffersService, useValue: advancedOffersServiceMock },
        { provide: AffiliatesService, useValue: affiliatesServiceMock },
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
    state.shippingZones.clear();
    state.coupons.clear();
    state.outboxEvents.length = 0;
    state.cartItems = createDefaultCartItems();
    state.checkedOutCartIds.clear();
    state.recoveryTokens.clear();
    state.openedRecoveryTokens.clear();
    state.clickedRecoveryTokens.clear();
    state.recoveredCheckouts.length = 0;
    state.recoveryTokens.set('valid-recovery-token', {
      cartId: OPEN_CART_ID,
      expired: false,
      redirectUrl: `http://localhost:3001/checkout?cartId=${OPEN_CART_ID}&recoveryToken=valid-recovery-token&store=demo`,
    });
    state.recoveryTokens.set('expired-recovery-token', {
      cartId: OPEN_CART_ID,
      expired: true,
      redirectUrl: `http://localhost:3001/checkout?cartId=${OPEN_CART_ID}&recoveryToken=expired-recovery-token&store=demo`,
    });
  });

  after(async () => {
    await app.close();
  });

  it('creates and lists shipping zones', async () => {
    const created = await requestJson(
      '/shipping-zones',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          name: 'Riyadh Express',
          city: 'Riyadh',
          area: 'North',
          fee: 25,
        }),
      },
      201,
      baseUrl,
    );

    assert.equal(created.name, 'Riyadh Express');
    assert.equal(created.fee, 25);
    assert.equal(typeof created.id, 'string');

    const listed = await requestJson(
      '/shipping-zones',
      {
        method: 'GET',
        headers: adminHeaders(false),
      },
      200,
      baseUrl,
    );

    assert.equal(Array.isArray(listed), true);
    assert.equal(listed.length >= 1, true);
    assert.equal(
      listed.some((item) => item.id === created.id),
      true,
    );
  });

  it('creates and applies coupon', async () => {
    const code = `WELCOME${Math.floor(Math.random() * 1000)}`;

    const created = await requestJson(
      '/promotions/coupons',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code,
          discountType: 'percent',
          discountValue: 10,
          minOrderAmount: 100,
        }),
      },
      201,
      baseUrl,
    );

    assert.equal(created.code, code.toUpperCase());
    assert.equal(created.discountType, 'percent');

    const applied = await requestJson(
      '/promotions/coupons/apply',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code,
          subtotal: 200,
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(applied.code, code.toUpperCase());
    assert.equal(applied.discount, 20);
    assert.equal(applied.subtotal, 200);
  });

  it('rejects applying a missing coupon', async () => {
    await requestError(
      '/promotions/coupons/apply',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code: 'NOPE99',
          subtotal: 200,
        }),
      },
      404,
      'Coupon not found',
      baseUrl,
    );
  });

  it('rejects checkout with missing coupon code', async () => {
    await requestError(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          couponCode: 'NOPE99',
          paymentMethod: 'cod',
        }),
      },
      404,
      'Coupon not found',
      baseUrl,
    );
  });

  it('rejects applying an expired coupon', async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString();

    await requestJson(
      '/promotions/coupons',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code: 'EXPIRED10',
          discountType: 'percent',
          discountValue: 10,
          endsAt: expiredAt,
        }),
      },
      201,
      baseUrl,
    );

    await requestError(
      '/promotions/coupons/apply',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code: 'EXPIRED10',
          subtotal: 200,
        }),
      },
      400,
      'Coupon expired',
      baseUrl,
    );
  });

  it('rejects coupon discount percent above 100', async () => {
    await requestError(
      '/promotions/coupons',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code: 'OVER100',
          discountType: 'percent',
          discountValue: 120,
        }),
      },
      400,
      'Percent discount must be between 0 and 100',
      baseUrl,
    );
  });

  it('rejects offer discount percent above 100', async () => {
    await requestError(
      '/promotions/offers',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          name: 'Too Large',
          targetType: 'cart',
          discountType: 'percent',
          discountValue: 150,
        }),
      },
      400,
      'Percent discount must be between 0 and 100',
      baseUrl,
    );
  });

  it('checks out cart with shipping and coupon discount', async () => {
    const shippingZone = await requestJson(
      '/shipping-zones',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          name: 'Checkout Zone',
          fee: 25,
        }),
      },
      201,
      baseUrl,
    );

    await requestJson(
      '/promotions/coupons',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          code: 'CHECK10',
          discountType: 'percent',
          discountValue: 10,
        }),
      },
      201,
      baseUrl,
    );

    const checkout = await requestJson(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          shippingZoneId: shippingZone.id,
          couponCode: 'CHECK10',
          paymentMethod: 'cod',
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(checkout.status, 'new');
    assert.equal(checkout.shippingFee, 25);
    assert.equal(checkout.discountTotal, 20);
    assert.equal(checkout.total, 205);

    const orderCreatedEvent = state.outboxEvents.find(
      (event) => event.eventType === 'order.created',
    );
    assert.equal(orderCreatedEvent !== undefined, true);
    assert.equal(orderCreatedEvent.payload.storeId, STORE_ID);
  });

  it('rejects checkout with inactive shipping zone', async () => {
    const inactiveZone = await requestJson(
      '/shipping-zones',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          name: 'Inactive Zone',
          fee: 10,
          isActive: false,
        }),
      },
      201,
      baseUrl,
    );

    await requestError(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          shippingZoneId: inactiveZone.id,
          paymentMethod: 'cod',
        }),
      },
      400,
      'Shipping zone not found or inactive',
      baseUrl,
    );
  });

  it('tracks abandoned recovery email open via pixel endpoint', async () => {
    const response = await fetch(`${baseUrl}/sf/recovery/valid-recovery-token/open`, {
      method: 'GET',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type')?.includes('image/gif'), true);
    assert.equal(state.openedRecoveryTokens.has('valid-recovery-token'), true);
  });

  it('redirects recovery link and tracks click', async () => {
    const response = await fetch(`${baseUrl}/sf/recovery/valid-recovery-token`, {
      method: 'GET',
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get('location'),
      `http://localhost:3001/checkout?cartId=${OPEN_CART_ID}&recoveryToken=valid-recovery-token&store=demo`,
    );
    assert.equal(state.clickedRecoveryTokens.has('valid-recovery-token'), true);
  });

  it('rejects expired recovery token', async () => {
    await requestError(
      '/sf/recovery/expired-recovery-token',
      {
        method: 'GET',
        redirect: 'manual',
      },
      400,
      'Recovery link has expired',
      baseUrl,
    );
  });

  it('attributes recovered checkout after token click and checkout completion', async () => {
    const recoveryResponse = await fetch(`${baseUrl}/sf/recovery/valid-recovery-token`, {
      method: 'GET',
      redirect: 'manual',
    });

    assert.equal(recoveryResponse.status, 302);
    assert.equal(state.clickedRecoveryTokens.has('valid-recovery-token'), true);

    const checkout = await requestJson(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Recovered Customer',
          customerPhone: '+966500111111',
          customerEmail: 'recover@example.com',
          addressLine: 'Recovery street 1',
          city: 'Riyadh',
          area: 'North',
          paymentMethod: 'cod',
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(checkout.status, 'new');
    assert.equal(state.recoveredCheckouts.length, 1);
    assert.equal(state.recoveredCheckouts[0].storeId, STORE_ID);
    assert.equal(state.recoveredCheckouts[0].cartId, OPEN_CART_ID);
    assert.equal(typeof state.recoveredCheckouts[0].orderId, 'string');
  });

  it('rejects checkout when cart is already checked out', async () => {
    await requestJson(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          paymentMethod: 'cod',
        }),
      },
      200,
      baseUrl,
    );

    await requestError(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          paymentMethod: 'cod',
        }),
      },
      400,
      'Cart not found or already checked out',
      baseUrl,
    );
  });

  it('rejects checkout for empty cart', async () => {
    state.cartItems = [];

    await requestError(
      '/sf/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cartId: OPEN_CART_ID,
          customerName: 'Ahmed Saleh',
          customerPhone: '+966500000000',
          customerEmail: 'ahmed@example.com',
          addressLine: 'Olaya Street 22',
          city: 'Riyadh',
          area: 'North',
          paymentMethod: 'cod',
        }),
      },
      400,
      'Cart is empty',
      baseUrl,
    );
  });
});

function adminHeaders(withBody = true) {
  const headers = {
    authorization: 'Bearer smoke-test-token',
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

async function requestError(path, init, expectedStatus, expectedMessage, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();

  assert.equal(response.status, expectedStatus, `Unexpected status for ${path}`);
  assert.equal(body.message, expectedMessage);
}
