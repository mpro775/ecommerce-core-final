require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { describe, it } = require('node:test');

const { DomainsService } = require('../dist/domains/domains.service');
const { PaymentsService } = require('../dist/payments/payments.service');
const { StoresService } = require('../dist/stores/stores.service');
const { ThemesService } = require('../dist/themes/themes.service');
const { WebhooksService } = require('../dist/webhooks/webhooks.service');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const CURRENT_USER = {
  id: USER_ID,
  storeId: STORE_ID,
  email: 'owner@example.com',
  fullName: 'Owner',
  role: 'owner',
  permissions: ['*'],
  sessionId: '33333333-3333-4333-8333-333333333333',
};

describe('Sprint 9 release readiness checks', () => {
  it('tracks webhook delivery usage and records successful delivery', async () => {
    const createdDeliveries = [];
    const usageEvents = [];

    const webhooksRepositoryMock = {
      async listActiveEndpointsForEvent() {
        return [
          {
            id: randomUUID(),
            url: 'https://webhook.example.com/orders',
            secret_key: 'secret',
          },
        ];
      },
      async createDelivery(input) {
        const record = {
          id: randomUUID(),
          store_id: input.storeId,
          endpoint_id: input.endpointId,
          event_type: input.eventType,
          payload: input.payload,
          signature: input.signature,
          request_headers: input.requestHeaders,
          response_status: null,
          response_body: null,
          response_headers: null,
          attempt_number: 1,
          delivered_at: null,
          next_retry_at: null,
          error_message: null,
          created_at: new Date(),
        };
        createdDeliveries.push(record);
        return record;
      },
      async markDeliverySuccess() {
        return;
      },
      async markDeliveryFailure() {
        return;
      },
    };

    const webhookSigningServiceMock = {
      signPayload() {
        return { signature: 'sig', timestamp: new Date().toISOString() };
      },
      getSignatureHeaders() {
        return { signature: 'x-ecommerce_core-signature', timestamp: 'x-ecommerce_core-timestamp' };
      },
    };

    const saasServiceMock = {
      async assertFeatureEnabled() {
        return;
      },
      async assertMetricCanGrow(storeId, metricKey, increment) {
        usageEvents.push({ type: 'assert', storeId, metricKey, increment });
      },
      async recordUsageEvent(storeId, metricKey, value, metadata) {
        usageEvents.push({ type: 'record', storeId, metricKey, value, metadata });
      },
    };

    const webhooksService = new WebhooksService(
      webhooksRepositoryMock,
      webhookSigningServiceMock,
      { async log() {} },
      saasServiceMock,
    );

    const originalFetch = global.fetch;
    global.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    try {
      const dispatchedTo = await webhooksService.dispatchEvent(STORE_ID, 'order.updated', {
        orderId: randomUUID(),
      });

      assert.equal(dispatchedTo, 1);
      assert.equal(createdDeliveries.length, 1);
      assert.equal(
        usageEvents.some(
          (event) =>
            event.type === 'assert' &&
            event.metricKey === 'webhooks.monthly' &&
            event.increment === 1,
        ),
        true,
      );
      assert.equal(
        usageEvents.some(
          (event) =>
            event.type === 'record' && event.metricKey === 'webhooks.monthly' && event.value === 1,
        ),
        true,
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles payment receipt upload and status review flow', async () => {
    const paymentId = randomUUID();
    const orderId = randomUUID();
    let currentStatus = 'pending';

    const paymentsRepositoryMock = {
      async findByOrderId() {
        return {
          id: paymentId,
          store_id: STORE_ID,
          order_id: orderId,
          method: 'transfer',
          status: currentStatus,
          amount: '400.00',
          receipt_url: null,
          receipt_media_asset_id: null,
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
          customer_uploaded_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
      async findById() {
        return {
          id: paymentId,
          store_id: STORE_ID,
          order_id: orderId,
          method: 'transfer',
          status: currentStatus,
          amount: '400.00',
          receipt_url: 'https://cdn.example.com/receipt.png',
          receipt_media_asset_id: randomUUID(),
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
          customer_uploaded_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
      async findWithOrderById() {
        return {
          id: paymentId,
          store_id: STORE_ID,
          order_id: orderId,
          method: 'transfer',
          status: currentStatus,
          amount: '400.00',
          receipt_url: 'https://cdn.example.com/receipt.png',
          receipt_media_asset_id: randomUUID(),
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
          customer_uploaded_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          order_code: 'ORD-1',
          order_status: 'new',
          order_total: '400.00',
          order_currency_code: 'YER',
          customer_name: 'Test Customer',
          customer_phone: '700000000',
        };
      },
      async updateReceipt() {
        currentStatus = 'under_review';
        return {
          id: paymentId,
          store_id: STORE_ID,
          order_id: orderId,
          method: 'transfer',
          status: 'under_review',
          amount: '400.00',
          receipt_url: 'https://cdn.example.com/receipt.png',
          receipt_media_asset_id: randomUUID(),
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
          customer_uploaded_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
      async updateStatus(_input) {
        currentStatus = 'approved';
        return {
          id: paymentId,
          store_id: STORE_ID,
          order_id: orderId,
          method: 'transfer',
          status: 'approved',
          amount: '400.00',
          receipt_url: 'https://cdn.example.com/receipt.png',
          receipt_media_asset_id: randomUUID(),
          reviewed_at: new Date(),
          reviewed_by: USER_ID,
          review_note: 'approved in readiness suite',
          customer_uploaded_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
    };

    const paymentsService = new PaymentsService(
      paymentsRepositoryMock,
      {
        async findById() {
          return { id: randomUUID(), public_url: 'https://cdn.example.com/receipt.png' };
        },
      },
      { async log() {} },
      { async enqueue() {} },
      { async handlePaymentStatusChanged() {} },
    );

    const uploaded = await paymentsService.uploadReceipt(
      CURRENT_USER,
      { orderId, mediaAssetId: randomUUID() },
      { ipAddress: '127.0.0.1', userAgent: 'test', requestId: 'req-1' },
    );
    assert.equal(uploaded.status, 'under_review');

    const reviewed = await paymentsService.updateStatus(
      CURRENT_USER,
      paymentId,
      { status: 'approved', reviewNote: 'approved in readiness suite' },
      { ipAddress: '127.0.0.1', userAgent: 'test', requestId: 'req-2' },
    );
    assert.equal(reviewed.status, 'approved');
  });

  it('updates store policies fields end-to-end in store settings service', async () => {
    const storesRepositoryMock = {
      async findById() {
        return {
          id: STORE_ID,
          name: 'Store',
          slug: 'store',
          logo_media_asset_id: null,
          logo_url: null,
          phone: null,
          address: null,
          country: 'اليمن',
          city: null,
          address_details: null,
          latitude: null,
          longitude: null,
          working_hours: [],
          social_links: {},
          currency_code: 'SAR',
          timezone: 'Asia/Riyadh',
          shipping_policy: null,
          return_policy: null,
          privacy_policy: null,
          terms_of_service: null,
        };
      },
      async updateSettings(input) {
        return {
          id: STORE_ID,
          name: input.name,
          slug: 'store',
          logo_media_asset_id: input.logoMediaAssetId,
          logo_url: input.logoUrl,
          phone: input.phone,
          address: input.address,
          country: input.country,
          city: input.city,
          address_details: input.addressDetails,
          latitude: input.latitude,
          longitude: input.longitude,
          working_hours: input.workingHours,
          social_links: input.socialLinks,
          currency_code: input.currencyCode,
          timezone: input.timezone,
          shipping_policy: input.shippingPolicy,
          return_policy: input.returnPolicy,
          privacy_policy: input.privacyPolicy,
          terms_of_service: input.termsOfService,
        };
      },
    };

    const storesService = new StoresService(storesRepositoryMock, { async log() {} });
    const updated = await storesService.updateSettings(
      CURRENT_USER,
      {
        city: 'صنعاء',
        addressDetails: 'شارع الزبيري',
        latitude: 15.353115,
        longitude: 44.207794,
        socialLinks: {
          instagram: 'https://instagram.com/ecommerce_core',
          website: 'https://ecommerce_core.store',
        },
        shippingPolicy: 'Ships in 2 business days',
        returnPolicy: 'Returns in 7 days',
        privacyPolicy: 'No sharing without consent',
        termsAndConditions: 'Usage terms',
      },
      { ipAddress: null, userAgent: null, requestId: 'req-store' },
    );

    assert.equal(updated.shippingPolicy, 'Ships in 2 business days');
    assert.equal(updated.returnPolicy, 'Returns in 7 days');
    assert.equal(updated.privacyPolicy, 'No sharing without consent');
    assert.equal(updated.termsAndConditions, 'Usage terms');
    assert.equal(typeof updated.address, 'string');
    assert.equal(updated.address.includes('صنعاء'), true);
    assert.equal(updated.address.includes('شارع الزبيري'), true);
    assert.equal(updated.latitude, 15.353115);
    assert.equal(updated.longitude, 44.207794);
    assert.equal(updated.socialLinks.instagram, 'https://instagram.com/ecommerce_core');
  });

  it('rejects invalid social links in store settings service', async () => {
    const storesRepositoryMock = {
      async findById() {
        return {
          id: STORE_ID,
          name: 'Store',
          slug: 'store',
          logo_media_asset_id: null,
          logo_url: null,
          phone: null,
          address: null,
          country: 'اليمن',
          city: null,
          address_details: null,
          latitude: null,
          longitude: null,
          working_hours: [],
          social_links: {},
          currency_code: 'SAR',
          timezone: 'Asia/Riyadh',
          shipping_policy: null,
          return_policy: null,
          privacy_policy: null,
          terms_of_service: null,
        };
      },
      async updateSettings() {
        throw new Error('should not be called');
      },
    };

    const storesService = new StoresService(storesRepositoryMock, { async log() {} });

    await assert.rejects(
      () =>
        storesService.updateSettings(
          CURRENT_USER,
          {
            socialLinks: {
              instagram: 'not-a-url',
            },
          },
          { ipAddress: null, userAgent: null, requestId: 'req-store-invalid-social' },
        ),
      /Invalid social link URL/,
    );
  });

  it('syncs cloudflare ssl status for active domain', async () => {
    const domainId = randomUUID();
    const baseDomain = {
      id: domainId,
      store_id: STORE_ID,
      hostname: 'shop.example.com',
      verification_token: 'token',
      status: 'active',
      ssl_status: 'requested',
      ssl_provider: 'cloudflare',
      ssl_mode: 'full_strict',
      cloudflare_zone_id: 'zone-1',
      cloudflare_hostname_id: 'cf-host-1',
      ssl_validation_records: [],
      last_dns_check_at: null,
      last_dns_check_result: [],
      support_required: false,
      technical_error_code: null,
      technical_error_message: null,
      ssl_last_checked_at: null,
      ssl_error: null,
      verified_at: new Date(),
      activated_at: new Date(),
    };

    const domainsRepositoryMock = {
      async findById() {
        return baseDomain;
      },
      async updateSslState() {
        return {
          ...baseDomain,
          ssl_status: 'issued',
          ssl_last_checked_at: new Date(),
          ssl_error: null,
        };
      },
    };

    const domainsService = new DomainsService(
      domainsRepositoryMock,
      {},
      { async enqueue() {} },
      { async log() {} },
      {
        get(key, fallback) {
          if (key === 'DOMAIN_VERIFY_TXT_PREFIX') return '_kaleem-verify';
          if (key === 'DOMAIN_CNAME_TARGET') return 'stores.example.com';
          return fallback;
        },
      },
      {},
      {
        isEnabled() {
          return true;
        },
        async getCustomHostname() {
          return { sslStatus: 'issued', validationRecords: [] };
        },
      },
      {
        async checkRecord() {
          return { status: 'valid' };
        },
      },
    );

    const result = await domainsService.syncSslStatus(CURRENT_USER, domainId, {
      ipAddress: null,
      userAgent: null,
      requestId: 'req-domain',
    });

    assert.equal(result.sslStatus, 'issued');
    assert.equal(result.sslProvider, 'cloudflare');
  });

  it('falls back to default published theme when stored config is invalid', async () => {
    const themesService = new ThemesService(
      {
        async findByStoreId() {
          return {
            id: randomUUID(),
            store_id: STORE_ID,
            version: 1,
            draft_config: {},
            published_config: {},
          };
        },
      },
      { async enqueue() {} },
      { async log() {} },
      { get: (_key, fallback) => fallback },
    );

    const published = await themesService.getStorefrontTheme(STORE_ID);
    assert.equal(published.mode, 'published');
    assert.equal(published.config.schemaVersion, 3);
    assert.equal(published.config.template.renderer, 'component');
    assert.equal(published.config.template.componentKey, 'general-starter');
    assert.equal(Array.isArray(published.config.sections), false);
  });
});
