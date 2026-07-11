const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

const { PlatformCoreController } = require('../dist/platform-admin/core/platform-core.controller');
const {
  PlatformBillingController,
} = require('../dist/platform-admin/billing/platform-billing.controller');
const { SaasService } = require('../dist/saas/saas.service');
const { SaasRepository } = require('../dist/saas/saas.repository');
const { AuditService } = require('../dist/audit/audit.service');
const { PlatformAccessTokenGuard } = require('../dist/platform/guards/platform-access-token.guard');
const { PlatformPermissionsGuard } = require('../dist/platform/guards/platform-permissions.guard');
const { PlatformStepUpGuard } = require('../dist/platform/guards/platform-step-up.guard');

describe('Sprint 15 platform admin contracts', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformCoreController, PlatformBillingController],
      providers: [
        {
          provide: SaasService,
          useValue: {
            async getPlatformDashboardSummary() {
              return {
                totalStores: 3,
                activeStores: 2,
                suspendedStores: 1,
                totalSubscriptions: 3,
                activeSubscriptions: 2,
                trialingSubscriptions: 0,
                pastDueSubscriptions: 1,
                canceledSubscriptions: 0,
                totalDomains: 2,
                domainIssues: 1,
              };
            },
            async getPlatformAnalyticsOverview() {
              return {
                mrrChurn: { totalMrr: 1200, churnRate: 0.03 },
                cohorts: [{ cohort: '2026-01', retainedPercent: 82 }],
                funnel: { visits: 1000, trialStarts: 150, paidConversions: 37 },
                generatedAt: new Date('2026-04-02T00:00:00.000Z').toISOString(),
              };
            },
            async getPlatformFinanceOverview() {
              return {
                totalMrr: 1200,
                openInvoicesAmount: 300,
                failedInvoicesAmount: 80,
                overdueInvoicesCount: 2,
                activePaidSubscriptions: 2,
              };
            },
            async listPlatformFinanceAging() {
              return [{ bucket: '1_30', invoices: 2, amount: 300 }];
            },
            async listPlatformFinanceCollections(limit) {
              return [
                {
                  invoiceId: 'inv-1',
                  invoiceNumber: 'INV-0001',
                  storeId: 'store-1',
                  storeName: 'Alpha Store',
                  status: 'open',
                  dueAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
                  totalAmount: 300,
                  currencyCode: 'YER',
                  updatedAt: new Date('2026-04-02T00:00:00.000Z').toISOString(),
                },
              ].slice(0, limit);
            },
            async listPlatformAuditLogs() {
              return {
                items: [
                  {
                    id: 'audit-1',
                    action: 'platform.support_case_created',
                    targetType: 'platform_support_case',
                    targetId: 'case-1',
                    metadata: { priority: 'high' },
                    createdAt: new Date('2026-04-02T00:00:00.000Z').toISOString(),
                    storeId: 'store-1',
                  },
                ],
                total: 1,
                page: 1,
                limit: 10,
              };
            },
          },
        },
        {
          provide: SaasRepository,
          useValue: {
            async getPlatformDashboardSummary() {
              return {
                total_stores: '3',
                active_stores: '2',
                suspended_stores: '1',
                total_subscriptions: '3',
                active_subscriptions: '2',
                trialing_subscriptions: '0',
                past_due_subscriptions: '1',
                canceled_subscriptions: '0',
                total_domains: '2',
                domain_issues: '1',
              };
            },
            async getPlatformMrrChurnSummary() {
              return { totalMrr: 1200, churnRate: 0.03 };
            },
            async getPlatformCohorts() {
              return [{ cohort: '2026-01', retainedPercent: 82 }];
            },
            async getPlatformFunnelSummary() {
              return { visits: 1000, trialStarts: 150, paidConversions: 37 };
            },
            async getPlatformFinanceOverview() {
              return {
                totalMrr: 1200,
                openInvoicesAmount: 300,
                failedInvoicesAmount: 80,
                overdueInvoicesCount: 2,
                activePaidSubscriptions: 2,
              };
            },
            async listPlatformFinanceAging() {
              return [{ bucket: '1_30', invoices: 2, amount: 300 }];
            },
            async listPlatformFinanceCollections(limit) {
              return [
                {
                  invoice_id: 'inv-1',
                  invoice_number: 'INV-0001',
                  store_id: 'store-1',
                  store_name: 'Alpha Store',
                  status: 'open',
                  due_at: new Date('2026-04-01T00:00:00.000Z'),
                  total_amount: 300,
                  currency_code: 'YER',
                  updated_at: new Date('2026-04-02T00:00:00.000Z'),
                },
              ].slice(0, limit);
            },
            async listPlatformAuditLogs() {
              return {
                rows: [
                  {
                    id: 'audit-1',
                    action: 'platform.support_case_created',
                    target_type: 'platform_support_case',
                    target_id: 'case-1',
                    metadata: { priority: 'high' },
                    created_at: new Date('2026-04-02T00:00:00.000Z'),
                    store_id: 'store-1',
                  },
                ],
                total: 1,
              };
            },
          },
        },
        { provide: AuditService, useValue: { async log() {} } },
      ],
    })
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

  after(async () => {
    if (app) await app.close();
  });

  it('returns dashboard/analytics/finance/audit payloads with stable contract keys', async () => {
    const dashboard = await requestJson('/platform/dashboard/summary', 200, baseUrl);
    assert.ok(typeof dashboard.totalStores === 'number');
    assert.ok(typeof dashboard.domainIssues === 'number');

    const analytics = await requestJson('/platform/analytics/overview', 200, baseUrl);
    assert.ok(analytics.mrrChurn);
    assert.ok(analytics.funnel);
    assert.ok(Array.isArray(analytics.cohorts));
    assert.ok(analytics.generatedAt);

    const financeOverview = await requestJson('/platform/finance/overview', 200, baseUrl);
    assert.ok(typeof financeOverview.totalMrr === 'number');
    assert.ok(typeof financeOverview.activePaidSubscriptions === 'number');

    const aging = await requestJson('/platform/finance/aging', 200, baseUrl);
    assert.ok(Array.isArray(aging));
    assert.equal(aging[0].bucket, '1_30');

    const collections = await requestJson('/platform/finance/collections?limit=10', 200, baseUrl);
    assert.ok(Array.isArray(collections));
    assert.equal(collections[0].invoiceId, 'inv-1');
    assert.equal(collections[0].invoiceNumber, 'INV-0001');

    const audit = await requestJson('/platform/audit/logs?page=1&limit=10', 200, baseUrl);
    assert.ok(Array.isArray(audit.items));
    assert.equal(audit.total, 1);
    assert.equal(audit.items[0].action, 'platform.support_case_created');
  });
});

async function requestJson(path, expectedStatus, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { authorization: 'Bearer contract-test-token' },
  });
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
