import process from 'node:process';
import pg from 'pg';

const connectionString = process.env.PHASE3_PHASE5_RECONCILIATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('PHASE3_PHASE5_RECONCILIATION_DATABASE_URL or DATABASE_URL is required');
  process.exit(1);
}
const mode = process.argv.includes('--apply-safe') ? 'apply-safe' : 'report';
const pool = new pg.Pool({ connectionString, max: 3 });
const checks = [
  ['orders_without_items', `SELECT o.store_id,o.id entity_id FROM orders o WHERE NOT EXISTS
    (SELECT 1 FROM order_items i WHERE i.store_id=o.store_id AND i.order_id=o.id)`],
  ['orders_missing_payment', `SELECT o.store_id,o.id entity_id FROM orders o WHERE NOT EXISTS
    (SELECT 1 FROM payments p WHERE p.store_id=o.store_id AND p.order_id=o.id)`],
  ['multiple_initial_payments', `SELECT store_id,order_id entity_id,COUNT(*)::int count FROM payments
    GROUP BY store_id,order_id HAVING COUNT(*)>1`],
  ['duplicate_order_numbers', `SELECT store_id,MIN(id::text)::uuid entity_id,order_code,COUNT(*)::int count
    FROM orders GROUP BY store_id,order_code HAVING COUNT(*)>1`],
  ['legacy_order_numbers', `SELECT store_id,id entity_id,order_code FROM orders
    WHERE order_code !~ '^[A-Z0-9]{2,8}-ORD-[0-9]{4}-[0-9]{6}$'`],
  ['order_fulfillment_contradictions', `SELECT store_id,id entity_id,status,fulfillment_status FROM orders
    WHERE (status='completed' AND fulfillment_status<>'fulfilled')
       OR (status='cancelled' AND fulfillment_status<>'cancelled')
       OR (status='new' AND fulfillment_status<>'unfulfilled')`],
  ['completed_nonapproved_payment', `SELECT o.store_id,o.id entity_id,p.status payment_status FROM orders o
    LEFT JOIN payments p ON p.store_id=o.store_id AND p.order_id=o.id
    WHERE o.status='completed' AND p.status IS DISTINCT FROM 'approved'`],
  ['cancelled_active_reservation', `SELECT o.store_id,o.id entity_id,r.id reservation_id FROM orders o
    JOIN inventory_reservations r ON r.store_id=o.store_id AND r.order_id=o.id
    WHERE o.status='cancelled' AND r.status='active'`],
  ['completed_active_reservation', `SELECT o.store_id,o.id entity_id,r.id reservation_id FROM orders o
    JOIN inventory_reservations r ON r.store_id=o.store_id AND r.order_id=o.id
    WHERE o.status='completed' AND r.status='active'`],
  ['refunded_without_amount', `SELECT store_id,id entity_id,status,paid_amount,refunded_amount FROM payments
    WHERE status='refunded' AND (paid_amount<=0 OR refunded_amount<=0)`],
  ['refund_above_paid', `SELECT store_id,id entity_id,paid_amount,refunded_amount FROM payments
    WHERE refunded_amount>paid_amount`],
  ['coupon_counter_mismatch', `WITH actual AS (
      SELECT c.store_id,c.id coupon_id,c.used_count,
        COUNT(u.id) FILTER (WHERE u.status='consumed')::int actual_count
      FROM coupons c LEFT JOIN coupon_usages u ON u.store_id=c.store_id AND u.coupon_id=c.id
      GROUP BY c.store_id,c.id,c.used_count)
    SELECT store_id,coupon_id entity_id,used_count,actual_count FROM actual WHERE used_count<>actual_count
    UNION ALL
    SELECT cc.store_id,cc.coupon_id entity_id,cc.consumed_count,
      COUNT(u.id) FILTER (WHERE u.status='consumed')::int actual_count
    FROM coupon_customer_counters cc LEFT JOIN coupon_usages u
      ON u.store_id=cc.store_id AND u.coupon_id=cc.coupon_id AND u.customer_id=cc.customer_id
    GROUP BY cc.store_id,cc.coupon_id,cc.customer_id,cc.consumed_count
    HAVING cc.consumed_count<>COUNT(u.id) FILTER (WHERE u.status='consumed')`],
  ['cancelled_consumed_coupon', `SELECT o.store_id,o.id entity_id,u.id usage_id FROM orders o JOIN coupon_usages u
    ON u.store_id=o.store_id AND u.order_id=o.id WHERE o.status='cancelled' AND u.status='consumed'`],
  ['loyalty_wallet_ledger_mismatch', `SELECT w.store_id,w.id entity_id,w.available_points,
      COALESCE(SUM(l.points_delta) FILTER (WHERE l.status IN ('available','reversed')),0)::int ledger_points
    FROM customer_loyalty_wallets w LEFT JOIN loyalty_ledger_entries l
      ON l.store_id=w.store_id AND l.customer_id=w.customer_id
    GROUP BY w.store_id,w.id,w.available_points
    HAVING w.available_points<>COALESCE(SUM(l.points_delta) FILTER (WHERE l.status IN ('available','reversed')),0)`],
  ['duplicate_affiliate_business_keys', `SELECT store_id,MIN(id::text)::uuid entity_id,business_key,COUNT(*)::int count
    FROM affiliate_commissions GROUP BY store_id,business_key HAVING COUNT(*)>1`],
  ['order_history_gaps', `SELECT o.store_id,o.id entity_id,o.status,
      (SELECT h.to_status FROM order_status_history h WHERE h.store_id=o.store_id AND h.order_id=o.id
       ORDER BY h.created_at DESC,h.id DESC LIMIT 1) history_status
    FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.store_id=o.store_id AND h.order_id=o.id)
      OR o.status IS DISTINCT FROM (SELECT h.to_status FROM order_status_history h
        WHERE h.store_id=o.store_id AND h.order_id=o.id ORDER BY h.created_at DESC,h.id DESC LIMIT 1)`],
  ['missing_recent_critical_outbox', `SELECT h.store_id,h.order_id entity_id,h.command FROM order_status_history h
    WHERE h.created_at>=NOW()-INTERVAL '30 days' AND h.command IN ('confirmOrder','cancelOrder','completeOrder')
      AND NOT EXISTS (SELECT 1 FROM outbox_events e WHERE e.aggregate_id=h.order_id::text
        AND e.event_type=CASE h.command WHEN 'confirmOrder' THEN 'order.confirmed'
          WHEN 'cancelOrder' THEN 'order.cancelled' ELSE 'order.completed' END)`],
  ['webhook_stranded_without_retry', `SELECT store_id,id entity_id,status FROM webhook_deliveries
    WHERE status IN ('pending','failed') AND next_attempt_at IS NULL`],
  ['stale_processing_rows', `SELECT NULL::uuid store_id,id::text entity_id,'outbox' source FROM outbox_events
    WHERE status='processing' AND locked_at<NOW()-INTERVAL '5 minutes'
    UNION ALL SELECT store_id,id::text entity_id,'webhook' source FROM webhook_deliveries
    WHERE status='processing' AND locked_at<NOW()-INTERVAL '5 minutes'`],
  ['fulfillment_legacy_values', `SELECT store_id,id entity_id,fulfillment_status FROM orders WHERE fulfillment_status
    NOT IN ('unfulfilled','preparing','ready','out_for_delivery','fulfilled','failed','cancelled')`],
  ['historical_returned_rows', `SELECT store_id,id entity_id,legacy_returned_at FROM orders
    WHERE legacy_returned_at IS NOT NULL`],
];

const safeNames = new Set(['coupon_counter_mismatch', 'stale_processing_rows']);
const historicalNames = new Set(['legacy_order_numbers', 'historical_returned_rows']);
const report = { mode, generatedAt: new Date().toISOString(), checks: [], safeRepairsApplied: 0,
  ambiguousRowsRequiringManualAction: 0 };

async function applySafeRepairs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const coupons = await client.query(`UPDATE coupons c SET used_count=s.actual_count,updated_at=NOW()
      FROM (SELECT c2.id,c2.store_id,COUNT(u.id) FILTER (WHERE u.status='consumed')::int actual_count
        FROM coupons c2 LEFT JOIN coupon_usages u ON u.store_id=c2.store_id AND u.coupon_id=c2.id
        GROUP BY c2.id,c2.store_id) s WHERE c.id=s.id AND c.store_id=s.store_id AND c.used_count<>s.actual_count`);
    const customerCounters = await client.query(`UPDATE coupon_customer_counters cc
      SET consumed_count=s.actual_count,updated_at=NOW() FROM (
        SELECT cc2.store_id,cc2.coupon_id,cc2.customer_id,
          COUNT(u.id) FILTER (WHERE u.status='consumed')::int actual_count
        FROM coupon_customer_counters cc2 LEFT JOIN coupon_usages u ON u.store_id=cc2.store_id
          AND u.coupon_id=cc2.coupon_id AND u.customer_id=cc2.customer_id
        GROUP BY cc2.store_id,cc2.coupon_id,cc2.customer_id) s
      WHERE cc.store_id=s.store_id AND cc.coupon_id=s.coupon_id AND cc.customer_id=s.customer_id
        AND cc.consumed_count<>s.actual_count`);
    const outbox = await client.query(`UPDATE outbox_events SET status='pending',locked_at=NULL,locked_by=NULL,
      next_attempt_at=NOW(),updated_at=NOW(),last_error=COALESCE(last_error,'reconciler recovered stale processing row')
      WHERE status='processing' AND locked_at<NOW()-INTERVAL '5 minutes'`);
    const webhooks = await client.query(`UPDATE webhook_deliveries SET status='pending',locked_at=NULL,locked_by=NULL,
      next_attempt_at=NOW(),updated_at=NOW(),last_error=COALESCE(last_error,'reconciler recovered stale processing row')
      WHERE status='processing' AND locked_at<NOW()-INTERVAL '5 minutes'`);
    report.safeRepairsApplied = [coupons,customerCounters,outbox,webhooks]
      .reduce((sum,result)=>sum+(result.rowCount??0),0);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

try {
  console.log(`Phase 3 + Phase 5 reconciliation mode=${mode}`);
  const before = new Map();
  for (const [name, sql] of checks) {
    const result = await pool.query(sql);
    before.set(name, result.rowCount ?? 0);
    report.checks.push({ name, before: result.rowCount ?? 0, after: null,
      affected: result.rows.slice(0, 100) });
  }
  if (mode === 'apply-safe') await applySafeRepairs();
  for (let index=0;index<checks.length;index+=1) {
    const [name,sql]=checks[index];
    const result=await pool.query(sql);
    report.checks[index].after=result.rowCount??0;
    const count=result.rowCount??0;
    if (!safeNames.has(name) && !historicalNames.has(name)) {
      report.ambiguousRowsRequiringManualAction += count;
    }
    console.log(`${String(index+1).padStart(2,'0')}. ${name}: before=${before.get(name)} after=${count}`);
  }
  console.log(JSON.stringify({ safeRepairsApplied:report.safeRepairsApplied,
    ambiguousRowsRequiringManualAction:report.ambiguousRowsRequiringManualAction },null,2));
  if (report.ambiguousRowsRequiringManualAction > 0) process.exitCode=2;
} finally { await pool.end(); }
