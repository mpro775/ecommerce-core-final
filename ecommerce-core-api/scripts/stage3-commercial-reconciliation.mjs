import process from 'node:process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.STAGE3_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL or STAGE3_TEST_DATABASE_URL is required');
  process.exit(1);
}

const applySafeInventory = process.argv.includes('--apply-safe-inventory');
const operatorName = process.env.STAGE3_RECONCILIATION_OPERATOR?.trim() || process.env.USERNAME || 'unknown';
const pool = new pg.Pool({ connectionString, max: 2 });

const checks = [
  ['duplicate_payments', `SELECT store_id, order_id AS entity_id, COUNT(*)::int AS count
    FROM payments GROUP BY store_id, order_id HAVING COUNT(*) > 1`],
  ['duplicate_coupon_usages', `SELECT store_id, order_id AS entity_id, COUNT(*)::int AS count
    FROM coupon_usages GROUP BY store_id, order_id HAVING COUNT(*) > 1`],
  ['duplicate_commissions', `SELECT store_id, order_id AS entity_id, COUNT(*)::int AS count
    FROM affiliate_commissions GROUP BY store_id, order_id HAVING COUNT(*) > 1`],
  ['duplicate_loyalty_operations', `SELECT store_id, MIN(id::text)::uuid AS entity_id, business_key, COUNT(*)::int AS count
    FROM loyalty_ledger_entries GROUP BY store_id, business_key HAVING COUNT(*) > 1`],
  ['inventory_reserved_mismatch', `SELECT wi.store_id, wi.id AS entity_id, wi.variant_id,
      wi.reserved_quantity AS stored, COALESCE(SUM(ir.quantity) FILTER (WHERE ir.status = 'active'), 0)::int AS expected
    FROM warehouse_inventory wi LEFT JOIN inventory_reservations ir
      ON ir.store_id = wi.store_id AND ir.warehouse_id = wi.warehouse_id AND ir.variant_id = wi.variant_id
    GROUP BY wi.store_id, wi.id, wi.variant_id, wi.reserved_quantity
    HAVING wi.reserved_quantity <> COALESCE(SUM(ir.quantity) FILTER (WHERE ir.status = 'active'), 0)`],
  ['cart_multiple_orders', `SELECT store_id, cart_id AS entity_id, COUNT(*)::int AS count
    FROM orders WHERE cart_id IS NOT NULL GROUP BY store_id, cart_id HAVING COUNT(*) > 1`],
  ['orders_without_items', `SELECT o.store_id, o.id AS entity_id
    FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)`],
  ['orders_without_payment', `SELECT o.store_id, o.id AS entity_id
    FROM orders o WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.store_id = o.store_id AND p.order_id = o.id)`],
  ['orders_without_created_event', `SELECT o.store_id, o.id AS entity_id
    FROM orders o WHERE NOT EXISTS (
      SELECT 1 FROM outbox_events e WHERE e.event_type = 'order.created' AND e.aggregate_id = o.id::text
    )`],
];

let ambiguousCount = 0;
try {
  console.log(`Stage 3 reconciliation mode=${applySafeInventory ? 'apply-safe-inventory' : 'report-only'}`);
  for (const [name, sql] of checks) {
    const before = await pool.query(sql);
    console.log(`${name}: before=${before.rowCount}`);
    if (name === 'inventory_reserved_mismatch' && applySafeInventory && before.rowCount > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const row of before.rows) {
          const updated = await client.query(
            `UPDATE warehouse_inventory SET reserved_quantity = $2, updated_at = NOW()
             WHERE id = $1 AND reserved_quantity = $3 RETURNING reserved_quantity`,
            [row.entity_id, row.expected, row.stored],
          );
          if (updated.rowCount !== 1) throw new Error(`Concurrent inventory change for ${row.entity_id}`);
          await client.query(
            `INSERT INTO stage3_reconciliation_audit
             (id, check_name, store_id, entity_id, before_value, after_value, action, operator_name)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
            [randomUUID(), name, row.store_id, row.entity_id, JSON.stringify(row),
             JSON.stringify({ reserved_quantity: row.expected }), 'reconcile_reserved_quantity', operatorName],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else if (name !== 'inventory_reserved_mismatch') {
      ambiguousCount += before.rowCount;
    }
    const after = await pool.query(sql);
    console.log(`${name}: after=${after.rowCount}`);
  }
  if (ambiguousCount > 0) {
    console.error(`BLOCKED: ${ambiguousCount} ambiguous financial/order records require human review; nothing was deleted.`);
    process.exitCode = 2;
  } else {
    console.log('Stage 3 reconciliation completed without ambiguous records.');
  }
} finally {
  await pool.end();
}
