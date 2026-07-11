require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AnalyticsService } = require('../dist/analytics/analytics.service');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const CURRENT_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  storeId: STORE_ID,
  email: 'owner@example.com',
  fullName: 'Owner',
  role: 'owner',
  permissions: ['*'],
  sessionId: '33333333-3333-4333-8333-333333333333',
};

describe('Sprint 10 analytics governance', () => {
  it('computes healthy data quality score when checks are clean', async () => {
    const analyticsService = createAnalyticsService({
      dataQualitySnapshot: {
        orders_without_items: 0,
        payments_without_orders: 0,
        negative_order_totals: 0,
        events_without_session: 0,
        events_in_future: 0,
      },
    });

    const report = await analyticsService.getDataQualityReport(CURRENT_USER, 30);
    assert.equal(report.status, 'healthy');
    assert.equal(report.score, 100);
    assert.equal(
      report.checks.every((check) => check.severity === 'ok'),
      true,
    );
  });

  it('detects anomalies and emits critical alerts', async () => {
    const events = [];
    const analyticsService = createAnalyticsService(
      {
        currentKpiSnapshot: {
          net_sales: '1000',
          total_orders: 120,
          approved_payments: 80,
          checkout_completes: 20,
          store_visits: 200,
        },
        previousKpiSnapshot: {
          net_sales: '2500',
          total_orders: 250,
          approved_payments: 210,
          checkout_completes: 80,
          store_visits: 220,
        },
      },
      events,
    );

    const output = await analyticsService.runGovernanceMonitoring(CURRENT_USER, {
      windowDays: 30,
      thresholdPercent: 20,
    });

    assert.equal(output.anomalies.alerts.length > 0, true);
    assert.equal(output.emittedAlerts > 0, true);
    assert.equal(
      events.every((event) => event.eventType === 'analytics.anomaly_detected'),
      true,
    );
  });
});

function createAnalyticsService(overrides = {}, emittedEvents = []) {
  let kpiCall = 0;
  const now = Date.now();

  const analyticsRepository = {
    async resolveWindowBounds() {
      return {
        start_at: new Date(now - 30 * 24 * 60 * 60 * 1000),
        end_at: new Date(now),
      };
    },
    async getDataQualitySnapshot() {
      return (
        overrides.dataQualitySnapshot ?? {
          orders_without_items: 1,
          payments_without_orders: 0,
          negative_order_totals: 0,
          events_without_session: 0,
          events_in_future: 0,
        }
      );
    },
    async getKpiWindowSnapshot() {
      kpiCall += 1;
      if (kpiCall === 1) {
        return (
          overrides.currentKpiSnapshot ?? {
            net_sales: '2000',
            total_orders: 100,
            approved_payments: 95,
            checkout_completes: 60,
            store_visits: 300,
          }
        );
      }
      return (
        overrides.previousKpiSnapshot ?? {
          net_sales: '1900',
          total_orders: 98,
          approved_payments: 90,
          checkout_completes: 58,
          store_visits: 290,
        }
      );
    },
  };

  const storesRepository = {
    async findById() {
      return {
        id: STORE_ID,
        name: 'Demo',
        slug: 'demo',
        logo_url: null,
        phone: null,
        address: null,
        currency_code: 'SAR',
        timezone: 'Asia/Riyadh',
        shipping_policy: null,
        return_policy: null,
        privacy_policy: null,
        terms_of_service: null,
      };
    },
  };

  const outboxService = {
    async enqueue(event) {
      emittedEvents.push(event);
    },
  };

  return new AnalyticsService(analyticsRepository, storesRepository, outboxService);
}
