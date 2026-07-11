const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { canTransitionOrderStatus } = require('../dist/orders/constants/order-status.constants');
const { AnalyticsRepository } = require('../dist/analytics/analytics.repository');

describe('Phase 3 launch closure rules', () => {
  it('allows the simple Yemen order status transitions', () => {
    assert.equal(canTransitionOrderStatus('preparing', 'completed'), true);
    assert.equal(canTransitionOrderStatus('out_for_delivery', 'cancelled'), true);
    assert.equal(canTransitionOrderStatus('completed', 'returned'), true);
    assert.equal(canTransitionOrderStatus('completed', 'cancelled'), false);
  });

  it('builds delivery analytics from orders instead of shipment lifecycle tables', async () => {
    let queryText = '';
    const repository = new AnalyticsRepository({
      db: {
        query: async (sql) => {
          queryText = sql;
          return {
            rows: [
              {
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
              },
            ],
          };
        },
      },
    });

    await repository.getShipmentSummary({
      storeId: '00000000-0000-4000-8000-000000000001',
      startAt: new Date('2026-05-01T00:00:00Z'),
      endAt: new Date('2026-06-01T00:00:00Z'),
    });

    assert.match(queryText, /FROM orders/);
    assert.doesNotMatch(queryText, /FROM shipments/);
  });
});
