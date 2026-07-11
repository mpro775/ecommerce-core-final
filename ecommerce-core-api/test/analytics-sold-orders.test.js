require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AnalyticsRepository } = require('../dist/analytics/analytics.repository');
const {
  ANALYTICS_SOLD_ORDER_STATUSES,
} = require('../dist/analytics/constants/analytics.constants');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const START_AT = new Date('2026-05-01T00:00:00.000Z');
const END_AT = new Date('2026-05-31T23:59:59.000Z');

describe('Analytics sold-order filters', () => {
  it('counts only completed orders as net sales and net orders', async () => {
    const queries = [];
    const repository = createRepository(queries, {
      total_orders: 5,
      gross_sales: '1500',
      net_sales: '300',
      net_orders: 1,
      cancelled_orders: 1,
      returned_orders: 1,
    });

    const snapshot = await repository.getOverviewSnapshot({
      storeId: STORE_ID,
      startAt: START_AT,
      endAt: END_AT,
    });

    assert.equal(snapshot.net_sales, '300');
    assert.equal(snapshot.net_orders, 1);
    assert.equal(ANALYTICS_SOLD_ORDER_STATUSES[0], 'completed');

    const sql = normalizeSql(queries[0]);
    assert.match(sql, /SUM\(total\) FILTER \(WHERE status = 'completed'\)/);
    assert.match(sql, /COUNT\(\*\) FILTER \(WHERE status = 'completed'\)::int AS net_orders/);
    assert.doesNotMatch(sql, /status NOT IN \('cancelled', 'returned'\)/);
  });

  it('lists top-selling products from completed orders only', async () => {
    const queries = [];
    const repository = createRepository(queries, [
      {
        product_id: 'completed-product',
        product_title: 'Completed Product',
        units_sold: 3,
        revenue: '300',
      },
    ]);

    const products = await repository.listTopProducts({
      storeId: STORE_ID,
      startAt: START_AT,
      endAt: END_AT,
      limit: 10,
    });

    assert.deepEqual(
      products.map((product) => product.product_id),
      ['completed-product'],
    );

    const sql = normalizeSql(queries[0]);
    assert.match(sql, /o\.status = 'completed'/);
    assert.doesNotMatch(sql, /o\.status NOT IN \('cancelled', 'returned'\)/);
  });
});

function createRepository(queries, rows) {
  return new AnalyticsRepository({
    db: {
      async query(sql) {
        queries.push(sql);
        return { rows: Array.isArray(rows) ? rows : [rows] };
      },
    },
  });
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}
