require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { AccessTokenGuard } = require('../dist/auth/guards/access-token.guard');
const { AuditService } = require('../dist/audit/audit.service');
const { BillingController } = require('../dist/saas/billing.controller');
const { PlatformAccessTokenGuard } = require('../dist/platform/guards/platform-access-token.guard');
const { PlatformPermissionsGuard } = require('../dist/platform/guards/platform-permissions.guard');
const { PlatformStepUpGuard } = require('../dist/platform/guards/platform-step-up.guard');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');
const {
  PlatformBillingController,
} = require('../dist/platform-admin/billing/platform-billing.controller');
const { PlatformCoreController } = require('../dist/platform-admin/core/platform-core.controller');
const { SaasRepository } = require('../dist/saas/saas.repository');
const { SaasService } = require('../dist/saas/saas.service');
const { BillingService } = require('../dist/saas/services/billing.service');
const { ExportService } = require('../dist/saas/services/export.service');
const { FeatureEnforcementService } = require('../dist/saas/services/feature-enforcement.service');
const { PlanService } = require('../dist/saas/services/plan.service');
const { PlatformAdminService } = require('../dist/saas/services/platform-admin.service');
const { PlatformDashboardService } = require('../dist/saas/services/platform-dashboard.service');
const { PlatformDomainService } = require('../dist/saas/services/platform-domain.service');
const { PlatformOperationsService } = require('../dist/saas/services/platform-operations.service');
const { PlatformStoreService } = require('../dist/saas/services/platform-store.service');
const {
  SubscriptionAdjustmentService,
} = require('../dist/saas/services/subscription-adjustment.service');
const { SubscriptionService } = require('../dist/saas/services/subscription.service');
const { TenantGuard } = require('../dist/tenancy/guards/tenant.guard');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
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
  plans: new Map(),
  planLimits: new Map(),
  planEntitlements: new Map(),
  subscriptions: new Map(),
  stores: new Map(),
  domains: [],
  adjustments: [],
};

const saasRepositoryMock = {
  async listPlans() {
    return [...state.plans.values()];
  },
  async findPlanByCode(code) {
    return (
      [...state.plans.values()].find((plan) => plan.code.toLowerCase() === code.toLowerCase()) ??
      null
    );
  },
  async findPlanById(planId) {
    return state.plans.get(planId) ?? null;
  },
  async createPlan(input) {
    const row = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description,
      is_active: input.isActive,
      monthly_price: input.monthlyPrice?.toString() ?? null,
      annual_price: input.annualPrice?.toString() ?? null,
      currency_code: input.currencyCode ?? 'YER',
      billing_cycle_options: input.billingCycleOptions ?? ['monthly'],
      trial_days_default: input.trialDaysDefault ?? 0,
      metadata: input.metadata ?? {},
    };
    state.plans.set(row.id, row);
    return row;
  },
  async updatePlan(input) {
    const row = state.plans.get(input.planId);
    if (!row) {
      return null;
    }

    const updated = {
      ...row,
      name: input.name,
      description: input.description,
      is_active: input.isActive,
      monthly_price: input.monthlyPrice?.toString() ?? null,
      annual_price: input.annualPrice?.toString() ?? null,
      currency_code: input.currencyCode ?? 'YER',
      billing_cycle_options: input.billingCycleOptions ?? ['monthly'],
      trial_days_default: input.trialDaysDefault ?? 0,
      metadata: input.metadata ?? {},
    };
    state.plans.set(updated.id, updated);
    return updated;
  },
  async listPlanLimits(planId) {
    return state.planLimits.get(planId) ?? [];
  },
  async replacePlanLimits(_db, planId, limits) {
    state.planLimits.set(
      planId,
      limits.map((limit) => ({
        id: randomUUID(),
        plan_id: planId,
        metric_key: limit.metricKey,
        metric_limit: limit.metricLimit,
        reset_period: limit.resetPeriod,
      })),
    );
  },
  async listPlanEntitlements(planId) {
    return state.planEntitlements.get(planId) ?? [];
  },
  async replacePlanEntitlements(_db, planId, entitlements) {
    state.planEntitlements.set(
      planId,
      entitlements.map((entitlement) => ({
        id: randomUUID(),
        plan_id: planId,
        feature_key: entitlement.featureKey,
        is_enabled: entitlement.isEnabled,
      })),
    );
  },
  async withTransaction(callback) {
    return callback({ query: async () => ({ rows: [], rowCount: 0 }) });
  },
  async getCurrentSubscription(storeId) {
    const record = state.subscriptions.get(storeId);
    if (!record) {
      return null;
    }

    const plan = state.plans.get(record.plan_id);
    return {
      ...record,
      plan_code: plan.code,
      plan_name: plan.name,
      plan_description: plan.description,
      plan_is_active: plan.is_active,
      plan_monthly_price: plan.monthly_price ?? null,
      plan_annual_price: plan.annual_price ?? null,
      plan_currency_code: plan.currency_code ?? 'YER',
    };
  },
  async getCurrentSubscriptionForUpdate(storeId) {
    return this.getCurrentSubscription(storeId);
  },
  async replaceCurrentSubscription(input) {
    state.subscriptions.set(input.storeId, {
      id: randomUUID(),
      store_id: input.storeId,
      plan_id: input.planId,
      status: input.status,
      starts_at: input.startsAt,
      current_period_end: input.currentPeriodEnd,
      trial_ends_at: input.trialEndsAt,
      billing_cycle: input.billingCycle ?? 'monthly',
      next_billing_at: input.nextBillingAt ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      canceled_at: input.canceledAt ?? null,
      provider_customer_id: input.providerCustomerId ?? null,
      provider_subscription_id: input.providerSubscriptionId ?? null,
    });
  },
  async updateSubscriptionStatus(storeId, status) {
    const record = state.subscriptions.get(storeId);
    if (!record) return false;
    record.status = status;
    state.subscriptions.set(storeId, record);
    return true;
  },
  async updateCurrentSubscriptionBilling(input) {
    const record = state.subscriptions.get(input.storeId);
    if (!record) return false;
    if (input.billingCycle !== undefined) record.billing_cycle = input.billingCycle;
    if (input.currentPeriodEnd !== undefined) record.current_period_end = input.currentPeriodEnd;
    if (input.trialEndsAt !== undefined) record.trial_ends_at = input.trialEndsAt;
    if (input.nextBillingAt !== undefined) record.next_billing_at = input.nextBillingAt;
    if (input.cancelAtPeriodEnd !== undefined)
      record.cancel_at_period_end = input.cancelAtPeriodEnd;
    if (input.canceledAt !== undefined) record.canceled_at = input.canceledAt;
    state.subscriptions.set(input.storeId, record);
    return true;
  },
  async createSubscriptionAdjustment(input) {
    const adjustment = {
      id: randomUUID(),
      store_id: input.storeId,
      subscription_id: input.subscriptionId,
      invoice_id: input.invoiceId ?? null,
      operation: input.operation,
      accounting_category: input.accountingCategory,
      affects_revenue: input.affectsRevenue,
      amount: input.amount == null ? null : String(input.amount),
      currency_code: input.currencyCode ?? null,
      days_delta: input.daysDelta ?? null,
      old_status: input.oldStatus ?? null,
      new_status: input.newStatus ?? null,
      old_billing_cycle: input.oldBillingCycle ?? null,
      new_billing_cycle: input.newBillingCycle ?? null,
      old_current_period_end: input.oldCurrentPeriodEnd ?? null,
      new_current_period_end: input.newCurrentPeriodEnd ?? null,
      old_next_billing_at: input.oldNextBillingAt ?? null,
      new_next_billing_at: input.newNextBillingAt ?? null,
      old_trial_ends_at: input.oldTrialEndsAt ?? null,
      new_trial_ends_at: input.newTrialEndsAt ?? null,
      reason: input.reason,
      note: input.note ?? null,
      created_by_admin_id: input.createdByAdminId ?? null,
      metadata: input.metadata ?? {},
      created_at: new Date(),
    };
    state.adjustments.push(adjustment);
    return adjustment;
  },
  async listSubscriptionAdjustmentsByStore(storeId) {
    const items = state.adjustments.filter((item) => item.store_id === storeId);
    return { items, total: items.length, page: 1, limit: 25 };
  },
  async listSubscriptionAdjustmentsBySubscription(subscriptionId) {
    const items = state.adjustments.filter((item) => item.subscription_id === subscriptionId);
    return { items, total: items.length, page: 1, limit: 25 };
  },
  async createBillingEvent() {
    return {
      id: randomUUID(),
      store_id: STORE_ID,
      source: 'internal_admin',
      event_type: 'subscription_adjustment.test',
      idempotency_key: null,
      payload: {},
      status: 'processed',
      processing_error: null,
      processed_at: new Date(),
      created_at: new Date(),
    };
  },
  async recordUsageEvent() {
    return;
  },
  async countProducts() {
    return 12;
  },
  async countStaff() {
    return 1;
  },
  async countOrdersForMonth() {
    return 7;
  },
  async countDomains() {
    return 1;
  },
  async getStorageUsedBytes() {
    return 1024 * 1024 * 500;
  },
  async countApiCallsForMonth() {
    return 250;
  },
  async countWebhooksForMonth() {
    return 12;
  },
  async listPlatformStores({ q }) {
    const rows = [...state.stores.values()].filter(
      (store) =>
        !q ||
        store.name.toLowerCase().includes(q.toLowerCase()) ||
        store.slug.toLowerCase().includes(q.toLowerCase()),
    );
    return { rows, total: rows.length };
  },
  async setStoreSuspension(input) {
    const row = state.stores.get(input.storeId);
    if (!row) {
      return false;
    }
    row.is_suspended = input.isSuspended;
    row.suspension_reason = input.reason;
    state.stores.set(row.id, row);
    return true;
  },
  async isStoreSuspended(storeId) {
    return Boolean(state.stores.get(storeId)?.is_suspended);
  },
  async listPlatformSubscriptions() {
    const rows = [];
    for (const sub of state.subscriptions.values()) {
      const store = state.stores.get(sub.store_id);
      const plan = state.plans.get(sub.plan_id);
      rows.push({
        id: sub.id,
        store_id: sub.store_id,
        store_name: store?.name ?? 'Unknown',
        store_slug: store?.slug ?? 'unknown',
        plan_code: plan.code,
        plan_name: plan.name,
        status: sub.status,
        starts_at: sub.starts_at,
        current_period_end: sub.current_period_end,
        trial_ends_at: sub.trial_ends_at,
        billing_cycle: sub.billing_cycle ?? 'monthly',
        next_billing_at: sub.next_billing_at ?? null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      });
    }
    return { rows, total: rows.length };
  },
  async listPlatformDomains() {
    return state.domains;
  },
  async listPlatformDomainsByStore(storeId) {
    return state.domains.filter((domain) => domain.store_id === storeId);
  },
  async findPlatformStoreById(storeId) {
    return state.stores.get(storeId) ?? null;
  },
  async getPlatformDashboardSummary() {
    return {
      total_stores: `${state.stores.size}`,
      active_stores: `${[...state.stores.values()].filter((row) => !row.is_suspended).length}`,
      suspended_stores: `${[...state.stores.values()].filter((row) => row.is_suspended).length}`,
      total_subscriptions: `${state.subscriptions.size}`,
      active_subscriptions: `${[...state.subscriptions.values()].filter((row) => row.status === 'active').length}`,
      trialing_subscriptions: `${[...state.subscriptions.values()].filter((row) => row.status === 'trialing').length}`,
      past_due_subscriptions: `${[...state.subscriptions.values()].filter((row) => row.status === 'past_due').length}`,
      canceled_subscriptions: `${[...state.subscriptions.values()].filter((row) => row.status === 'canceled').length}`,
      total_domains: `${state.domains.length}`,
      domain_issues: `${state.domains.filter((row) => row.ssl_status === 'error' || row.status === 'pending').length}`,
    };
  },
  async getPlatformGrowthSummary() {
    return {
      newStores7d: 1,
      newStores30d: 1,
      trialingSubscriptions: 0,
      paidSubscriptions: 1,
    };
  },
  async listPlatformDashboardAlerts() {
    return [];
  },
  async listRecentPlatformAuditActivity() {
    return [];
  },
  async listStoreAuditActivity() {
    return [];
  },
  async listPlatformDomainIssues() {
    return state.domains.filter(
      (domain) => domain.ssl_status === 'error' || domain.status === 'pending',
    );
  },
  async findPlatformDomainById(domainId) {
    return state.domains.find((domain) => domain.id === domainId) ?? null;
  },
  async touchPlatformDomainCheck(domainId) {
    const domain = state.domains.find((row) => row.id === domainId);
    if (!domain) {
      return null;
    }
    domain.ssl_last_checked_at = new Date();
    domain.updated_at = new Date();
    return {
      ...domain,
      store_name: domain.store_name ?? '',
    };
  },
  async setPlanActive(planId, isActive) {
    const plan = state.plans.get(planId);
    if (!plan) {
      return null;
    }
    const updated = {
      ...plan,
      is_active: isActive,
    };
    state.plans.set(planId, updated);
    return updated;
  },
};

const auditServiceMock = {
  async log() {
    return;
  },
};

describe('Sprint 6 SaaS platform e2e', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingController, PlatformBillingController, PlatformCoreController],
      providers: [
        SaasService,
        SubscriptionService,
        FeatureEnforcementService,
        PlanService,
        BillingService,
        PlatformStoreService,
        PlatformAdminService,
        PlatformDashboardService,
        PlatformDomainService,
        PlatformOperationsService,
        ExportService,
        SubscriptionAdjustmentService,
        { provide: SaasRepository, useValue: saasRepositoryMock },
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
      .overrideGuard(PlatformAccessTokenGuard)
      .useValue({
        canActivate(context) {
          const request = context.switchToHttp().getRequest();
          request.platformAdmin = {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'platform.admin@example.com',
            fullName: 'Platform Admin',
            status: 'active',
            permissions: ['*'],
            roleCodes: ['super_admin'],
            sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          };
          return true;
        },
      })
      .overrideGuard(PlatformPermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlatformStepUpGuard)
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
    state.plans.clear();
    state.planLimits.clear();
    state.planEntitlements.clear();
    state.subscriptions.clear();
    state.stores.clear();
    state.domains.length = 0;

    const freePlan = {
      id: randomUUID(),
      code: 'free',
      name: 'Free',
      description: 'Starter',
      is_active: true,
      monthly_price: null,
      annual_price: null,
      currency_code: 'YER',
      billing_cycle_options: ['monthly'],
      trial_days_default: 0,
      metadata: {},
    };
    state.plans.set(freePlan.id, freePlan);
    const proPlan = {
      id: randomUUID(),
      code: 'pro',
      name: 'Pro',
      description: 'Pro plan',
      is_active: true,
      monthly_price: '29',
      annual_price: '290',
      monthly_compare_at_price: null,
      annual_compare_at_price: null,
      currency_code: 'YER',
      billing_cycle_options: ['monthly', 'annual'],
      trial_days_default: 14,
      sale_label: null,
      sale_starts_at: null,
      sale_ends_at: null,
      is_intro_offer: false,
      is_sale_active: false,
      metadata: {},
    };
    state.plans.set(proPlan.id, proPlan);
    state.planLimits.set(freePlan.id, [
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        metric_key: 'products.total',
        metric_limit: 100,
        reset_period: 'lifetime',
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        metric_key: 'orders.monthly',
        metric_limit: 100,
        reset_period: 'monthly',
      },
    ]);
    state.planEntitlements.set(freePlan.id, [
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'custom_domains',
        is_enabled: true,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'advanced_promotions',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'priority_support',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'advanced_analytics',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'api_access',
        is_enabled: true,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'webhooks_access',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'staff_management',
        is_enabled: true,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'affiliate_program',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'loyalty_program',
        is_enabled: false,
      },
      {
        id: randomUUID(),
        plan_id: freePlan.id,
        feature_key: 'affiliates',
        is_enabled: false,
      },
    ]);

    state.stores.set(STORE_ID, {
      id: STORE_ID,
      name: 'Demo Store',
      slug: 'demo-store',
      is_suspended: false,
      suspension_reason: null,
      created_at: new Date(),
      plan_code: 'free',
      subscription_status: 'active',
      total_domains: 1,
      active_domains: 1,
    });

    state.domains.push({
      id: randomUUID(),
      store_id: STORE_ID,
      store_name: 'Demo Store',
      hostname: 'shop.example.com',
      status: 'active',
      ssl_status: 'requested',
      updated_at: new Date(),
    });
  });

  after(async () => {
    await app.close();
  });

  it('creates a plan and assigns it to store', async () => {
    const createdPlan = await requestJson(
      '/platform/plans',
      {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          code: 'starter-plus',
          name: 'Starter Plus',
          description: 'Starter plus limits',
          monthlyPrice: 19,
          annualPrice: 190,
          currencyCode: 'YER',
          billingCycleOptions: ['monthly', 'annual'],
          trialDaysDefault: 7,
          limits: [
            { metricKey: 'products.total', metricLimit: 250, resetPeriod: 'lifetime' },
            { metricKey: 'orders.monthly', metricLimit: 400, resetPeriod: 'monthly' },
            { metricKey: 'staff.total', metricLimit: 2, resetPeriod: 'lifetime' },
            { metricKey: 'domains.total', metricLimit: 1, resetPeriod: 'lifetime' },
            { metricKey: 'storage.used', metricLimit: 5, resetPeriod: 'lifetime' },
            { metricKey: 'api_calls.monthly', metricLimit: 5000, resetPeriod: 'monthly' },
            { metricKey: 'webhooks.monthly', metricLimit: 200, resetPeriod: 'monthly' },
          ],
          entitlements: [
            { featureKey: 'custom_domains', isEnabled: true },
            { featureKey: 'advanced_promotions', isEnabled: true },
            { featureKey: 'priority_support', isEnabled: false },
            { featureKey: 'advanced_analytics', isEnabled: true },
            { featureKey: 'api_access', isEnabled: true },
            { featureKey: 'webhooks_access', isEnabled: true },
            { featureKey: 'staff_management', isEnabled: true },
            { featureKey: 'affiliate_program', isEnabled: false },
            { featureKey: 'loyalty_program', isEnabled: true },
          ],
        }),
      },
      201,
      baseUrl,
    );

    assert.equal(createdPlan.code, 'starter-plus');
    assert.equal(createdPlan.limits.length, 7);

    const assigned = await requestJson(
      `/platform/stores/${STORE_ID}/subscription`,
      {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          planCode: 'starter-plus',
          status: 'active',
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(assigned.storeId, STORE_ID);
    assert.equal(assigned.plan.code, 'starter-plus');
    assert.equal(assigned.status, 'active');
    assert.equal(assigned.billingCycle, 'monthly');
    assert.ok(assigned.currentPeriodEnd);
    assert.ok(assigned.nextBillingAt);
  });

  it('assigns trial subscriptions with trial dates and rejects missing trial days', async () => {
    const failed = await requestJson(
      `/platform/stores/${STORE_ID}/subscription`,
      {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          planCode: 'pro',
          status: 'trialing',
        }),
      },
      400,
      baseUrl,
    );
    assert.match(JSON.stringify(failed), /trialDays|trial/i);

    const assigned = await requestJson(
      `/platform/stores/${STORE_ID}/subscription`,
      {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          planCode: 'pro',
          status: 'trialing',
          trialDays: 14,
          billingCycle: 'annual',
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(assigned.status, 'trialing');
    assert.equal(assigned.billingCycle, 'annual');
    assert.ok(assigned.trialEndsAt);
    assert.equal(assigned.currentPeriodEnd, assigned.trialEndsAt);
    assert.equal(assigned.nextBillingAt, assigned.trialEndsAt);
  });

  it('returns current billing subscription and usage snapshot', async () => {
    const freePlan = [...state.plans.values()].find((plan) => plan.code === 'free');
    state.subscriptions.set(STORE_ID, {
      id: randomUUID(),
      store_id: STORE_ID,
      plan_id: freePlan.id,
      status: 'active',
      starts_at: new Date(),
      current_period_end: null,
      trial_ends_at: null,
    });

    const billing = await requestJson(
      '/billing/subscription',
      {
        method: 'GET',
        headers: authHeaders(),
      },
      200,
      baseUrl,
    );

    assert.equal(billing.storeId, STORE_ID);
    assert.equal(billing.plan.code, 'free');
    assert.equal(Array.isArray(billing.usage), true);
    assert.equal(
      billing.usage.some((entry) => entry.metricKey === 'orders.monthly'),
      true,
    );
  });

  it('supports basic platform admin listing and suspension', async () => {
    const stores = await requestJson(
      '/platform/stores',
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(stores.items.length, 1);
    assert.equal(stores.items[0].slug, 'demo-store');

    await requestJson(
      `/platform/stores/${STORE_ID}/suspension`,
      {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({
          isSuspended: true,
          reason: 'Policy violation',
        }),
      },
      204,
      baseUrl,
    );

    const domains = await requestJson(
      '/platform/domains',
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(domains.length, 1);
    assert.equal(domains[0].hostname, 'shop.example.com');
  });

  it('returns platform dashboard and store/domain detail slices', async () => {
    const summary = await requestJson(
      '/platform/dashboard/summary',
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(summary.totalStores, 1);

    const store = await requestJson(
      `/platform/stores/${STORE_ID}`,
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(store.id, STORE_ID);

    const storeDomains = await requestJson(
      `/platform/stores/${STORE_ID}/domains`,
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(storeDomains.length, 1);

    const domain = state.domains[0];
    const domainDetails = await requestJson(
      `/platform/domains/${domain.id}`,
      { method: 'GET', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(domainDetails.id, domain.id);

    const rechecked = await requestJson(
      `/platform/domains/${domain.id}/recheck`,
      { method: 'POST', headers: authHeaders() },
      200,
      baseUrl,
    );
    assert.equal(rechecked.id, domain.id);
  });
});

function authHeaders() {
  return {
    authorization: 'Bearer smoke-test-token',
    'x-store-id': STORE_ID,
  };
}

function jsonHeaders() {
  return {
    ...authHeaders(),
    'content-type': 'application/json',
  };
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
