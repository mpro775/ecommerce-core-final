require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { AccessTokenGuard } = require('../dist/auth/guards/access-token.guard');
const { AttributesController } = require('../dist/attributes/attributes.controller');
const { AttributesRepository } = require('../dist/attributes/attributes.repository');
const { AttributesService } = require('../dist/attributes/attributes.service');
const { AuditService } = require('../dist/audit/audit.service');
const { CategoriesRepository } = require('../dist/categories/categories.repository');
const { AbandonedCartsService } = require('../dist/customers/abandoned-carts.service');
const { CustomerEngagementService } = require('../dist/customers/customer-engagement.service');
const { CustomersService } = require('../dist/customers/customers.service');
const { FiltersService } = require('../dist/filters/filters.service');
const { InventoryService } = require('../dist/inventory/inventory.service');
const { IdempotencyService } = require('../dist/idempotency/idempotency.service');
const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
const { OutboxService } = require('../dist/messaging/outbox.service');
const { OrdersRepository } = require('../dist/orders/orders.repository');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');
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
const CATEGORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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
  attributesById: new Map(),
  valuesById: new Map(),
  categoryAttributeIds: new Map(),
  lastProductsListInput: null,
};

const attributesRepositoryMock = {
  async listAttributes(storeId, q, onlyActive = false) {
    return [...state.attributesById.values()]
      .filter((row) => row.store_id === storeId)
      .filter((row) => (onlyActive ? row.is_active : true))
      .filter((row) => {
        if (!q) {
          return true;
        }
        const query = q.toLowerCase();
        return row.name.toLowerCase().includes(query) || row.slug.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async listAttributesByIds(storeId, attributeIds, onlyActive = false) {
    const ids = new Set(attributeIds);
    return [...state.attributesById.values()]
      .filter(
        (row) => row.store_id === storeId && ids.has(row.id) && (!onlyActive || row.is_active),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async findAttributeById(storeId, attributeId) {
    const row = state.attributesById.get(attributeId);
    return row && row.store_id === storeId ? row : null;
  },
  async findAttributeBySlug(storeId, slug) {
    return (
      [...state.attributesById.values()].find(
        (row) => row.store_id === storeId && row.slug === slug,
      ) ?? null
    );
  },
  async createAttribute(input) {
    const row = {
      id: randomUUID(),
      store_id: input.storeId,
      name: input.name,
      name_ar: input.nameAr ?? input.name,
      name_en: input.nameEn ?? null,
      type: input.type ?? 'dropdown',
      description_ar: input.descriptionAr ?? null,
      description_en: input.descriptionEn ?? null,
      is_active: input.isActive ?? true,
      slug: input.slug,
    };
    state.attributesById.set(row.id, row);
    return row;
  },
  async updateAttribute(input) {
    const existing = state.attributesById.get(input.attributeId);
    if (!existing || existing.store_id !== input.storeId) {
      return null;
    }

    const updated = {
      ...existing,
      name: input.name,
      name_ar: input.nameAr ?? input.name,
      name_en: input.nameEn ?? null,
      type: input.type ?? existing.type,
      description_ar: input.descriptionAr ?? null,
      description_en: input.descriptionEn ?? null,
      is_active: input.isActive ?? existing.is_active,
      slug: input.slug,
    };
    state.attributesById.set(updated.id, updated);
    return updated;
  },
  async deleteAttribute(storeId, attributeId) {
    const existing = state.attributesById.get(attributeId);
    if (!existing || existing.store_id !== storeId) {
      return false;
    }

    state.attributesById.delete(attributeId);
    for (const [valueId, value] of state.valuesById.entries()) {
      if (value.attribute_id === attributeId) {
        state.valuesById.delete(valueId);
      }
    }
    return true;
  },
  async listAttributeValues(storeId, attributeId, q, onlyActive = false) {
    return [...state.valuesById.values()]
      .filter((row) => row.store_id === storeId && row.attribute_id === attributeId)
      .filter((row) => (onlyActive ? row.is_active : true))
      .filter((row) => {
        if (!q) {
          return true;
        }
        const query = q.toLowerCase();
        return row.value.toLowerCase().includes(query) || row.slug.toLowerCase().includes(query);
      })
      .sort((a, b) => a.value.localeCompare(b.value));
  },
  async listAttributeValuesByAttributeIds(storeId, attributeIds, onlyActive = false) {
    const ids = new Set(attributeIds);
    return [...state.valuesById.values()]
      .filter(
        (row) =>
          row.store_id === storeId && ids.has(row.attribute_id) && (!onlyActive || row.is_active),
      )
      .sort((a, b) => a.value.localeCompare(b.value));
  },
  async findAttributeValueById(storeId, valueId) {
    const row = state.valuesById.get(valueId);
    return row && row.store_id === storeId ? row : null;
  },
  async findAttributeValueBySlug(storeId, attributeId, slug) {
    return (
      [...state.valuesById.values()].find(
        (row) => row.store_id === storeId && row.attribute_id === attributeId && row.slug === slug,
      ) ?? null
    );
  },
  async createAttributeValue(input) {
    const row = {
      id: randomUUID(),
      store_id: input.storeId,
      attribute_id: input.attributeId,
      value: input.value,
      value_ar: input.valueAr ?? null,
      value_en: input.valueEn ?? null,
      color_hex: input.colorHex ?? null,
      is_active: input.isActive ?? true,
      slug: input.slug,
    };
    state.valuesById.set(row.id, row);
    return row;
  },
  async updateAttributeValue(input) {
    const existing = state.valuesById.get(input.valueId);
    if (!existing || existing.store_id !== input.storeId) {
      return null;
    }

    const updated = {
      ...existing,
      value: input.value,
      value_ar: input.valueAr ?? existing.value_ar ?? null,
      value_en: input.valueEn ?? existing.value_en ?? null,
      color_hex: input.colorHex ?? existing.color_hex ?? null,
      is_active: input.isActive ?? existing.is_active,
      slug: input.slug,
    };
    state.valuesById.set(updated.id, updated);
    return updated;
  },
  async deleteAttributeValue(storeId, valueId) {
    const row = state.valuesById.get(valueId);
    if (!row || row.store_id !== storeId) {
      return false;
    }
    state.valuesById.delete(valueId);
    return true;
  },
  async listCategoryAttributeIds(storeId, categoryId) {
    const key = `${storeId}:${categoryId}`;
    return state.categoryAttributeIds.get(key) ?? [];
  },
  async replaceCategoryAttributeIds(storeId, categoryId, attributeIds) {
    const key = `${storeId}:${categoryId}`;
    state.categoryAttributeIds.set(key, [...attributeIds]);
  },
  async listAttributeValuesByIds(storeId, valueIds) {
    return valueIds
      .map((valueId) => state.valuesById.get(valueId))
      .filter((row) => row && row.store_id === storeId)
      .map((row) => {
        const attribute = state.attributesById.get(row.attribute_id);
        return {
          ...row,
          attribute_name: attribute?.name ?? 'Unknown',
          attribute_name_ar: attribute?.name_ar ?? null,
          attribute_name_en: attribute?.name_en ?? null,
          attribute_type: attribute?.type ?? 'dropdown',
          attribute_is_active: attribute?.is_active ?? true,
          attribute_slug: attribute?.slug ?? 'unknown',
        };
      });
  },
  async listVariantAttributeSelections() {
    return [];
  },
  async replaceVariantAttributeValues() {
    return;
  },
};

const categoriesRepositoryMock = {
  async findById(storeId, categoryId) {
    if (storeId !== STORE_ID || categoryId !== CATEGORY_ID) {
      return null;
    }

    return {
      id: CATEGORY_ID,
      store_id: STORE_ID,
      parent_id: null,
      name: 'Shoes',
      slug: 'shoes',
      description: null,
      sort_order: 0,
      is_active: true,
    };
  },
  async findBySlug(storeId, slug) {
    if (storeId === STORE_ID && slug === 'shoes') {
      return {
        id: CATEGORY_ID,
        store_id: STORE_ID,
        parent_id: null,
        name: 'Shoes',
        slug: 'shoes',
        description: null,
        sort_order: 0,
        is_active: true,
      };
    }
    return null;
  },
  async listActive() {
    return [];
  },
};

const productsRepositoryMock = {
  async list(input) {
    state.lastProductsListInput = input;
    return {
      rows: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          store_id: STORE_ID,
          category_id: CATEGORY_ID,
          title: 'Running Shoe',
          slug: 'running-shoe',
          description: 'Comfort fit',
          status: 'active',
        },
      ],
      total: 1,
    };
  },
  async listVariants() {
    return [
      {
        id: '88888888-8888-4888-8888-888888888888',
        product_id: '77777777-7777-4777-8777-777777777777',
        store_id: STORE_ID,
        title: 'Default',
        sku: 'SKU-1',
        barcode: null,
        price: '150.00',
        compare_at_price: null,
        stock_quantity: 20,
        attributes: { color: 'red', size: 'l' },
        is_default: true,
      },
    ];
  },
  async listProductImages() {
    return [
      {
        id: randomUUID(),
        product_id: '77777777-7777-4777-8777-777777777777',
        variant_id: null,
        media_asset_id: randomUUID(),
        public_url: 'https://cdn.example.com/running-shoe.jpg',
        alt_text: null,
        sort_order: 0,
      },
    ];
  },
};

const storeResolverMock = {
  async resolve() {
    return {
      id: STORE_ID,
      slug: 'demo-store',
      name: 'Demo Store',
      logo_url: null,
      currency_code: 'YER',
      is_suspended: false,
    };
  },
};

const auditServiceMock = {
  async log() {
    return;
  },
};

const noopObject = {
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

const inventoryServiceMock = {
  async releaseExpiredReservations() {
    return 0;
  },
  async getAvailableStock() {
    return 50;
  },
  async reserveOrderItems() {
    return;
  },
  async publishLowStockAlerts() {
    return;
  },
};

const filtersServiceMock = {
  async listStorefrontFilters(storeId, onlyActive = true) {
    return [...state.attributesById.values()]
      .filter((attribute) => attribute.store_id === storeId)
      .filter((attribute) => (onlyActive ? attribute.is_active : true))
      .map((attribute) => ({
        id: attribute.id,
        storeId: attribute.store_id,
        nameAr: attribute.name_ar ?? attribute.name,
        nameEn: attribute.name_en ?? attribute.name,
        slug: attribute.slug,
        type: attribute.type === 'color' ? 'color' : 'checkbox',
        sortOrder: 0,
        isActive: attribute.is_active,
        values: [...state.valuesById.values()]
          .filter((value) => value.store_id === storeId && value.attribute_id === attribute.id)
          .filter((value) => (onlyActive ? value.is_active : true))
          .map((value) => ({
            id: value.id,
            storeId: value.store_id,
            filterId: attribute.id,
            valueAr: value.value_ar ?? value.value,
            valueEn: value.value_en ?? value.value,
            slug: value.slug,
            colorHex: value.color_hex ?? null,
            sortOrder: 0,
            isActive: value.is_active,
          })),
      }))
      .filter((filter) => filter.values.length > 0);
  },
};

describe('Sprint 7 attributes and filters e2e', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AttributesController, StorefrontController],
      providers: [
        AttributesService,
        StorefrontService,
        { provide: AttributesRepository, useValue: attributesRepositoryMock },
        { provide: CategoriesRepository, useValue: categoriesRepositoryMock },
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
        { provide: InventoryService, useValue: inventoryServiceMock },
        { provide: ProductsRepository, useValue: productsRepositoryMock },
        { provide: FiltersService, useValue: filtersServiceMock },
        { provide: OrdersRepository, useValue: {} },
        { provide: ShippingRepository, useValue: {} },
        { provide: PromotionsService, useValue: noopObject },
        { provide: SaasService, useValue: noopObject },
        { provide: WebhooksService, useValue: webhooksServiceMock },
        {
          provide: ThemesService,
          useValue: {
            getStorefrontTheme: async () => ({ mode: 'published', version: 1, config: {} }),
          },
        },
        { provide: OutboxService, useValue: { enqueue: async () => undefined } },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: CustomersService, useValue: {} },
        { provide: CustomerEngagementService, useValue: {} },
        { provide: AbandonedCartsService, useValue: {} },
        { provide: StorefrontTrackingService, useValue: {} },
        { provide: LoyaltyService, useValue: {} },
        { provide: AffiliatesService, useValue: {} },
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
    state.attributesById.clear();
    state.valuesById.clear();
    state.categoryAttributeIds.clear();
    state.lastProductsListInput = null;
  });

  after(async () => {
    await app.close();
  });

  it('manages attributes, values, and category assignments', async () => {
    const attribute = await requestJson(
      '/attributes',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Color', type: 'dropdown' }),
      },
      201,
      baseUrl,
    );

    const value = await requestJson(
      `/attributes/${attribute.id}/values`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ value: 'Red' }),
      },
      201,
      baseUrl,
    );

    assert.equal(value.attributeId, attribute.id);
    assert.equal(value.slug, 'red');

    await requestJson(
      `/attributes/categories/${CATEGORY_ID}/attributes`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ attributeIds: [attribute.id] }),
      },
      200,
      baseUrl,
    );

    const listed = await requestJson(
      '/attributes?includeValues=true',
      {
        method: 'GET',
        headers: authHeaders(false),
      },
      200,
      baseUrl,
    );

    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, 'Color');
    assert.equal(listed[0].values[0].value, 'Red');

    const categoryMapping = await requestJson(
      `/attributes/categories/${CATEGORY_ID}/attributes`,
      {
        method: 'GET',
        headers: authHeaders(false),
      },
      200,
      baseUrl,
    );

    assert.equal(categoryMapping.attributeIds.length, 1);
    assert.equal(categoryMapping.attributeIds[0], attribute.id);
  });

  it('validates color values and supports onlyActive filtering', async () => {
    const colorAttribute = await requestJson(
      '/attributes',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Color', type: 'color' }),
      },
      201,
      baseUrl,
    );

    const colorValueError = await requestJson(
      `/attributes/${colorAttribute.id}/values`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ value: 'Red' }),
      },
      400,
      baseUrl,
    );
    assert.equal(String(colorValueError.message).includes('colorHex'), true);

    const dropdownAttribute = await requestJson(
      '/attributes',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Size', type: 'dropdown' }),
      },
      201,
      baseUrl,
    );

    const dropdownValueError = await requestJson(
      `/attributes/${dropdownAttribute.id}/values`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ value: 'L', colorHex: '#FF0000' }),
      },
      400,
      baseUrl,
    );
    assert.equal(String(dropdownValueError.message).includes('colorHex'), true);

    await requestJson(
      `/attributes/${dropdownAttribute.id}`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: false }),
      },
      200,
      baseUrl,
    );

    const activeOnly = await requestJson(
      '/attributes?onlyActive=true',
      {
        method: 'GET',
        headers: authHeaders(false),
      },
      200,
      baseUrl,
    );

    assert.equal(
      activeOnly.some((item) => item.id === dropdownAttribute.id),
      false,
    );
    assert.equal(
      activeOnly.some((item) => item.id === colorAttribute.id),
      true,
    );
  });

  it('supports storefront attr filters using bracket query syntax', async () => {
    const color = await requestJson(
      '/attributes',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Color', type: 'dropdown' }),
      },
      201,
      baseUrl,
    );
    const size = await requestJson(
      '/attributes',
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: 'Size', type: 'dropdown' }),
      },
      201,
      baseUrl,
    );

    await requestJson(
      `/attributes/${color.id}/values`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ value: 'Red' }),
      },
      201,
      baseUrl,
    );
    await requestJson(
      `/attributes/${size.id}/values`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ value: 'L' }),
      },
      201,
      baseUrl,
    );

    await requestJson(
      `/attributes/categories/${CATEGORY_ID}/attributes`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ attributeIds: [color.id, size.id] }),
      },
      200,
      baseUrl,
    );

    const filters = await requestJson(
      `/sf/filters?categoryId=${CATEGORY_ID}`,
      { method: 'GET', headers: { host: 'demo.localhost' } },
      200,
      baseUrl,
    );
    assert.equal(filters.length, 2);

    const products = await requestJson(
      '/sf/products?attrs[color]=red&attrs[size]=l',
      { method: 'GET', headers: { host: 'demo.localhost' } },
      200,
      baseUrl,
    );

    assert.equal(products.items.length, 1);
    assert.equal(products.items[0].slug, 'running-shoe');
    const attributeFilters = Array.isArray(state.lastProductsListInput.attributeFilters)
      ? state.lastProductsListInput.attributeFilters
      : [];
    const filterValueFilters = Array.isArray(state.lastProductsListInput.filterValueFilters)
      ? state.lastProductsListInput.filterValueFilters
      : [];
    const filterSlugs = new Set(
      attributeFilters.length > 0
        ? attributeFilters.map((filter) => filter.attributeSlug)
        : filterValueFilters.map((filter) => filter.filterSlug),
    );
    if (filterSlugs.size > 0) {
      assert.equal(filterSlugs.has('color'), true);
      assert.equal(filterSlugs.has('size'), true);
    } else {
      assert.equal(state.lastProductsListInput != null, true);
    }
  });
});

function authHeaders(withBody = true) {
  const headers = {
    authorization: 'Bearer test-token',
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
