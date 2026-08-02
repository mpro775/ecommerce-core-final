const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, describe, test } = require('node:test');

const databaseUrl = process.env.COMMERCIAL_CLOSURE_DATABASE_URL;
if (!databaseUrl) throw new Error('COMMERCIAL_CLOSURE_DATABASE_URL is required; this suite never skips');
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = 'test';
process.env.ORDER_NUMBER_PREFIX = 'TST';
require('reflect-metadata');

const { DatabaseService } = require('../dist/database/database.service');
const { MetricsService } = require('../dist/observability/metrics.service');
const { AuditService } = require('../dist/audit/audit.service');
const { OutboxService } = require('../dist/messaging/outbox.service');
const { IdempotencyRepository } = require('../dist/idempotency/idempotency.repository');
const { IdempotencyService } = require('../dist/idempotency/idempotency.service');
const { CommercialCommandIdempotencyService } = require('../dist/commercial/commercial-command-idempotency.service');
const { CommercialInvariantService } = require('../dist/commercial/commercial-invariant.service');
const { DocumentSequenceService } = require('../dist/commercial/document-sequence.service');
const { allocateDiscountStages } = require('../dist/commercial/money-allocation');
const { CheckoutTransactionService } = require('../dist/checkout/checkout-transaction.service');
const { InventoryRepository } = require('../dist/inventory/inventory.repository');
const { InventoryService } = require('../dist/inventory/inventory.service');
const { LoyaltyRepository } = require('../dist/loyalty/loyalty.repository');
const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
const { AffiliatesRepository } = require('../dist/affiliates/affiliates.repository');
const { AffiliatesService } = require('../dist/affiliates/affiliates.service');
const { PromotionsRepository } = require('../dist/promotions/promotions.repository');
const { PromotionsService } = require('../dist/promotions/promotions.service');
const { AdvancedOffersRepository } = require('../dist/advanced-offers/advanced-offers.repository');
const { AdvancedOffersService } = require('../dist/advanced-offers/advanced-offers.service');
const { OrdersRepository } = require('../dist/orders/orders.repository');
const { OrdersService } = require('../dist/orders/orders.service');
const { OrderTransitionService } = require('../dist/orders/transitions/order-transition.service');
const { FulfillmentTransitionService } = require('../dist/orders/transitions/fulfillment-transition.service');
const { PaymentTransitionService } = require('../dist/payments/payment-transition.service');
const { PaymentsRepository } = require('../dist/payments/payments.repository');
const { PaymentsService } = require('../dist/payments/payments.service');
const { PaymentMethodsRepository } = require('../dist/payment-methods/payment-methods.repository');
const { ShippingRepository } = require('../dist/shipping/shipping.repository');
const { ShippingCalculatorService } = require('../dist/shipping/shipping-calculator.service');
const { CurrencyService } = require('../dist/currency/currency.service');
const { WebhooksRepository } = require('../dist/webhooks/webhooks.repository');
const { WebhooksService } = require('../dist/webhooks/webhooks.service');
const { WebhookSigningService } = require('../dist/security/webhook-signing.service');

describe('Phase 3 + Phase 5 mandatory commercial closure on real PostgreSQL', { concurrency: false }, () => {
  const ids = {
    store: randomUUID(), user: randomUUID(), customer: randomUUID(), warehouse: randomUUID(),
    product: randomUUID(), variant: randomUUID(),
  };
  const slug = `closure-${ids.store}`;
  const actor = { id: ids.user, type: 'admin', permissions: ['*'] };
  const context = { requestId: `closure-${ids.store}`, ipAddress: '127.0.0.1', userAgent: 'node-test' };
  const config = { get: (key, fallback) => process.env[key] ?? fallback };
  let db, metrics, audit, outbox, idempotency, commercialIdempotency, invariants;
  let inventory, loyalty, affiliates, promotions, ordersRepository;
  let orderTransitions, fulfillmentTransitions, paymentTransitions, sequences, checkoutTransactions;
  let paymentMethods, webhooksRepository, webhooks;
  let ordersService;

  const query = (sql, values = []) => db.db.query(sql, values);
  const scalar = async (sql, values = []) => Number((await query(sql, values)).rows[0].value);
  const errorCode = (error) => {
    const response = typeof error?.getResponse === 'function' ? error.getResponse() : error?.response;
    return response?.code ?? error?.code ?? error?.message;
  };
  const command = async (service, input) => {
    const payload = { storeId: ids.store, idempotencyKey: randomUUID(), actor, context, ...input };
    return typeof service.execute === 'function' ? service.execute(payload) : service.transition(payload);
  };
  const currentOrderVersion = async (orderId) => Number((await query(
    'SELECT version::text FROM orders WHERE id=$1', [orderId])).rows[0].version);
  const currentPaymentVersion = async (paymentId) => Number((await query(
    'SELECT version::text FROM payments WHERE id=$1', [paymentId])).rows[0].version);

  async function tx(work) {
    const client = await db.db.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async function makeOrder({ method = 'cod', fulfillmentType = 'delivery', reserve = true,
    paymentStatus = 'pending', total = 100 } = {}) {
    const orderId = randomUUID();
    let paymentId;
    await tx(async (client) => {
      const orderCode = await sequences.allocate(client, { storeId: ids.store, documentType: 'ORD' });
      await ordersRepository.createOrder(client, {
        id: orderId, storeId: ids.store, customerId: ids.customer, orderCode,
        subtotal: total, total, shippingZoneId: null, shippingMethodId: null,
        shippingMethodSnapshot: { type: fulfillmentType }, fulfillmentType,
        shippingFee: 0, discountTotal: 0, couponCode: null, currencyCode: 'YER',
        exchangeRateYerPerUnit: 1, subtotalYER: total, totalYER: total,
        shippingFeeYER: 0, discountTotalYER: 0, pointsDiscountAmountYER: 0,
        note: 'commercial closure test',
        shippingAddress: { addressLine: 'Closure test address', city: 'Sanaa', area: 'Test' },
      });
      await ordersRepository.insertOrderItem(client, {
        orderId, storeId: ids.store, productId: ids.product, variantId: ids.variant,
        title: 'Immutable closure product', variantName: 'Default', sku: 'CLOSURE-SKU',
        unitPrice: total, unitPriceYER: total, quantity: 1, lineTotal: total,
        lineTotalYER: total, attributes: { closure: 'true' }, currencyCode: 'YER',
        productImage: null, discountAmount: 0, finalUnitPrice: total,
        lineSubtotal: total, lineDiscount: 0,
        taxSnapshot: { policy: 'not_configured', taxable: false, rate: '0.00', amount: '0.00' },
      });
      await ordersRepository.createPayment(client, {
        storeId: ids.store, orderId, method, amount: total, currencyCode: 'YER',
      });
      paymentId = (await client.query('SELECT id FROM payments WHERE order_id=$1', [orderId])).rows[0].id;
      if (reserve) await inventory.reserveOrderItems(client, {
        storeId: ids.store, orderId, expiresAt: new Date(Date.now() + 3600000),
        items: [{ variantId: ids.variant, quantity: 1, sku: 'CLOSURE-SKU' }],
        actorId: ids.user, actorType: 'admin', metadata: { source: 'closure-test' },
      });
      await ordersRepository.insertOrderStatusHistory(client, {
        storeId: ids.store, orderId, fromStatus: null, toStatus: 'new', actorId: ids.user,
        actorType: 'admin', command: 'closureTestCreate', reason: 'test fixture',
        requestId: context.requestId, businessKey: `order:${orderId}:created`,
      });
    });
    if (paymentStatus !== 'pending') {
      const paid = paymentStatus === 'approved' ? total : 0;
      await query(`UPDATE payments SET status=$2,paid_amount=$3,
        submission_version=CASE WHEN $2 IN ('submitted','under_review','approved','rejected') THEN 1 ELSE 0 END
        WHERE id=$1`, [paymentId, paymentStatus, paid]);
      if (paid > 0) await query('UPDATE orders SET paid_amount=$2 WHERE id=$1', [orderId, paid]);
    }
    return { orderId, paymentId };
  }

  before(async () => {
    db = new DatabaseService();
    metrics = new MetricsService(config); metrics.onModuleInit();
    audit = new AuditService(db);
    outbox = new OutboxService(db, { publish: async () => undefined }, metrics);
    const idempotencyRepository = new IdempotencyRepository();
    idempotency = new IdempotencyService(idempotencyRepository, db);
    commercialIdempotency = new CommercialCommandIdempotencyService(idempotency);
    invariants = new CommercialInvariantService();
    inventory = new InventoryService(new InventoryRepository(db), outbox, audit);
    loyalty = new LoyaltyService(new LoyaltyRepository(db), audit, outbox);
    affiliates = new AffiliatesService(new AffiliatesRepository(db), audit, outbox);
    const advanced = new AdvancedOffersService(new AdvancedOffersRepository(db), audit);
    promotions = new PromotionsService(new PromotionsRepository(db), audit, advanced, outbox, metrics);
    ordersRepository = new OrdersRepository(db);
    sequences = new DocumentSequenceService(metrics);
    orderTransitions = new OrderTransitionService(db, commercialIdempotency, invariants,
      inventory, promotions, loyalty, affiliates, audit, outbox, metrics);
    fulfillmentTransitions = new FulfillmentTransitionService(db, commercialIdempotency,
      invariants, inventory, audit, outbox, metrics);
    paymentTransitions = new PaymentTransitionService(db, commercialIdempotency, audit,
      outbox, affiliates, metrics);
    ordersService = new OrdersService(ordersRepository, inventory, promotions,
      new ShippingRepository(db), new ShippingCalculatorService(), audit, outbox, loyalty,
      affiliates, new CurrencyService(db), orderTransitions, sequences, commercialIdempotency);
    checkoutTransactions = new CheckoutTransactionService(db, idempotency, metrics);
    paymentMethods = new PaymentMethodsRepository(db);
    webhooksRepository = new WebhooksRepository(db);
    webhooks = new WebhooksService(webhooksRepository, new WebhookSigningService(config),
      audit, outbox, metrics);

    await query(`INSERT INTO stores (id,name,slug,currency_code,timezone,metadata)
      VALUES ($1,'Commercial Closure',$2,'YER','Asia/Aden','{}'::jsonb)`, [ids.store, slug]);
    await query(`INSERT INTO store_users (id,store_id,email,password_hash,full_name,role,permissions)
      VALUES ($1,$2,$3,'test-only','Closure Owner','owner','["*"]'::jsonb)`,
      [ids.user, ids.store, `closure-${ids.user}@example.test`]);
    await query(`INSERT INTO customers (id,store_id,full_name,phone)
      VALUES ($1,$2,'Closure Customer',$3)`, [ids.customer, ids.store, `7${ids.customer.replaceAll('-', '').slice(0,8)}`]);
    await query(`INSERT INTO products
      (id,store_id,title,slug,status,is_visible,stock_unlimited,product_type)
      VALUES ($1,$2,'Closure Product',$3,'active',TRUE,FALSE,'single')`,
      [ids.product, ids.store, `closure-product-${ids.product}`]);
    await query(`INSERT INTO product_variants
      (id,product_id,store_id,title,sku,price,stock_quantity,attributes,is_default)
      VALUES ($1,$2,$3,'Default',$4,100,10000,'{}'::jsonb,TRUE)`,
      [ids.variant, ids.product, ids.store, `CLOSURE-${ids.variant.slice(0,8)}`]);
    await query(`INSERT INTO warehouses (id,store_id,name,code,is_default,is_active,priority)
      VALUES ($1,$2,'Closure Warehouse',$3,TRUE,TRUE,1)`,
      [ids.warehouse, ids.store, `CL${ids.warehouse.slice(0,6)}`]);
    await query(`INSERT INTO warehouse_inventory
      (id,warehouse_id,variant_id,store_id,quantity,reserved_quantity,low_stock_threshold)
      VALUES ($1,$2,$3,$4,10000,0,5)`, [randomUUID(), ids.warehouse, ids.variant, ids.store]);
  });

  after(async () => {
    await query(`DELETE FROM outbox_events WHERE payload->>'storeId'=$1`, [ids.store]).catch(() => undefined);
    await query('DELETE FROM stores WHERE id=$1', [ids.store]).catch(() => undefined);
    await db.onModuleDestroy();
  });

  test('required PostgreSQL configuration is present and migrations 100-106 are applied', async () => {
    const rows = await query(`SELECT name FROM schema_migrations WHERE name LIKE '10%phase3%'
      OR name IN ('101_commercial_transition_histories','102_document_sequences',
        '103_commercial_command_permissions','104_commercial_command_idempotency',
        '105_webhook_delivery_recovery','106_payment_expiration_claims')`);
    assert.ok(rows.rowCount >= 7);
  });

  test('concurrent successful Checkout replay owns one transaction and payload mismatch conflicts', async () => {
    const key = randomUUID();
    const marker = randomUUID();
    let workCalls = 0;
    const input = { storeId: ids.store, actorId: ids.customer, operation: 'closure.success-checkout',
      idempotencyKey: key, requestHash: 'checkout-hash-a', work: async ({ db: client }) => {
        workCalls += 1;
        await client.query(`INSERT INTO stage3_reconciliation_audit
          (id,check_name,store_id,entity_id,before_value,after_value,action,operator_name)
          VALUES ($1,'closure-success',$2,$3,'{}','{}','test','closure')`,
          [marker, ids.store, ids.product]);
        return { status: 201, body: { orderId: marker, accepted: true }, orderId: null };
      } };
    const outcomes = await Promise.all([checkoutTransactions.execute(input), checkoutTransactions.execute(input)]);
    assert.equal(workCalls, 1);
    assert.equal(outcomes.filter((entry) => entry.replayed).length, 1);
    assert.deepEqual(outcomes[0].body, outcomes[1].body);
    assert.equal(outcomes[0].status, 201); assert.equal(outcomes[1].status, 201);
    assert.equal(await scalar('SELECT COUNT(*)::int value FROM stage3_reconciliation_audit WHERE id=$1', [marker]), 1);
    await assert.rejects(() => checkoutTransactions.execute({ ...input, requestHash: 'checkout-hash-b',
      work: async () => ({ status: 200, body: { impossible: true }, orderId: null }) }),
      (error) => errorCode(error) === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
  });

  test('failed Checkout replay preserves exact HTTP status/body and rolls back business effects', async () => {
    const key = randomUUID();
    const marker = randomUUID();
    let workCalls = 0;
    const input = { storeId: ids.store, actorId: ids.customer, operation: 'closure.failed-checkout',
      idempotencyKey: key, requestHash: 'same-hash', work: async ({ db: client }) => {
        workCalls += 1;
        await client.query(`INSERT INTO stage3_reconciliation_audit
          (id,check_name,store_id,entity_id,before_value,after_value,action,operator_name)
          VALUES ($1,'closure-failure',$2,$3,'{}','{}','test','closure')`,
          [marker, ids.store, ids.product]);
        const error = new Error('deterministic business rejection');
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      } };
    const first = await checkoutTransactions.execute(input);
    const replay = await checkoutTransactions.execute(input);
    assert.equal(first.status, replay.status);
    assert.deepEqual(first.body, replay.body);
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(workCalls, 1);
    assert.equal(await scalar('SELECT COUNT(*)::int value FROM stage3_reconciliation_audit WHERE id=$1', [marker]), 0);
  });

  test('100 concurrent document allocations are unique, partitioned, and rollback-safe', async () => {
    const allocateCommitted = () => tx((client) => sequences.allocate(client,
      { storeId: ids.store, documentType: 'INV', at: new Date('2031-01-01T00:00:00Z') }));
    const values = await Promise.all(Array.from({ length: 100 }, allocateCommitted));
    assert.equal(new Set(values).size, 100);
    assert.ok(values.every((value) => /^TST-INV-2031-\d{6}$/u.test(value)));
    let rolledBack;
    const client = await db.db.connect();
    try {
      await client.query('BEGIN');
      rolledBack = await sequences.allocate(client,
        { storeId: ids.store, documentType: 'REF', at: new Date('2032-01-01T00:00:00Z') });
      await client.query('ROLLBACK');
    } finally { client.release(); }
    const committed = await tx((connection) => sequences.allocate(connection,
      { storeId: ids.store, documentType: 'REF', at: new Date('2032-01-01T00:00:00Z') }));
    assert.equal(committed, rolledBack);
  });

  test('confirm versus cancel race commits exactly one transition and one effect set', async () => {
    const { orderId } = await makeOrder();
    const expectedVersion = await currentOrderVersion(orderId);
    const outcomes = await Promise.allSettled([
      command(orderTransitions, { orderId, command: 'confirmOrder', expectedVersion }),
      command(orderTransitions, { orderId, command: 'cancelOrder', expectedVersion, reason: 'race cancellation' }),
    ]);
    assert.equal(outcomes.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((entry) => entry.status === 'rejected').length, 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM order_status_history
      WHERE order_id=$1 AND command IN ('confirmOrder','cancelOrder')`, [orderId]), 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM audit_logs WHERE target_id=$1
      AND action IN ('orders.confirm','orders.cancel')`, [orderId]), 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events WHERE aggregate_id=$1
      AND event_type IN ('order.confirmed','order.cancelled')`, [orderId]), 1);
  });

  test('cancel order during preparing generates exactly one fulfillment history and outbox event with deduplication', async () => {
    const { orderId } = await makeOrder({ fulfillmentType: 'delivery' });
    let version = await currentOrderVersion(orderId);
    
    await command(orderTransitions, { orderId, command: 'confirmOrder', expectedVersion: version });
    
    version = await currentOrderVersion(orderId);
    await command(fulfillmentTransitions, { orderId, command: 'startPreparing', expectedVersion: version });

    version = await currentOrderVersion(orderId);
    const idempotencyKey = randomUUID();
    const cancelInput = { orderId, command: 'cancelOrder', expectedVersion: version, reason: 'user requested cancel', idempotencyKey };
    
    await command(orderTransitions, cancelInput);

    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM fulfillment_status_history
      WHERE order_id=$1 AND to_status='cancelled'`, [orderId]), 1);

    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events
      WHERE aggregate_id=$1 AND event_type='fulfillment.cancelled'`, [orderId]), 1);

    await command(orderTransitions, cancelInput);

    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM fulfillment_status_history
      WHERE order_id=$1 AND to_status='cancelled'`, [orderId]), 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events
      WHERE aggregate_id=$1 AND event_type='fulfillment.cancelled'`, [orderId]), 1);
  });

  test('delivery path, COD collection, completion invariants, and duplicate completion', async () => {
    const { orderId, paymentId } = await makeOrder({ fulfillmentType: 'delivery' });
    let version = await currentOrderVersion(orderId);
    await command(orderTransitions, { orderId, command: 'confirmOrder', expectedVersion: version });
    for (const fulfillmentCommand of ['startPreparing', 'markReady', 'dispatch', 'markFulfilled']) {
      version = await currentOrderVersion(orderId);
      await command(fulfillmentTransitions, { orderId, command: fulfillmentCommand, expectedVersion: version });
    }
    await command(paymentTransitions, { paymentId, command: 'collectCodPayment',
      expectedVersion: await currentPaymentVersion(paymentId), proof: { collectionReference: 'COD-CLOSURE' } });
    version = await currentOrderVersion(orderId);
    const completed = await command(orderTransitions,
      { orderId, command: 'completeOrder', expectedVersion: version });
    assert.equal(completed.status, 'completed');
    await assert.rejects(async () => command(orderTransitions,
      { orderId, command: 'completeOrder', expectedVersion: Number(completed.version) }),
      (error) => ['ORDER_ALREADY_COMPLETED','ORDER_TRANSITION_NOT_ALLOWED'].includes(errorCode(error)));
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservations
      WHERE order_id=$1 AND status='active'`, [orderId]), 0);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservation_events
      WHERE order_id=$1 AND event_type='consumed'`, [orderId]), 1);
  });

  test('pickup path rejects dispatch and fulfills directly from ready', async () => {
    const { orderId } = await makeOrder({ fulfillmentType: 'pickup', paymentStatus: 'approved' });
    await command(orderTransitions, { orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(orderId) });
    for (const fulfillmentCommand of ['startPreparing', 'markReady']) {
      await command(fulfillmentTransitions, { orderId, command: fulfillmentCommand,
        expectedVersion: await currentOrderVersion(orderId) });
    }
    const dispatchVersion = await currentOrderVersion(orderId);
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId, command: 'dispatch',
      expectedVersion: dispatchVersion }),
      (error) => errorCode(error) === 'FULFILLMENT_TRANSITION_NOT_ALLOWED');
    const result = await command(fulfillmentTransitions, { orderId, command: 'markFulfilled',
      expectedVersion: await currentOrderVersion(orderId) });
    assert.equal(result.fulfillmentStatus, 'fulfilled');
  });

  test('fulfillment failure recovery and terminal/prohibited paths are enforced', async () => {
    const delivery = await makeOrder({ fulfillmentType: 'delivery', paymentStatus: 'approved' });
    await command(orderTransitions, { orderId: delivery.orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(delivery.orderId) });
    for (const fulfillmentCommand of ['startPreparing', 'markReady', 'dispatch']) {
      await command(fulfillmentTransitions, { orderId: delivery.orderId, command: fulfillmentCommand,
        expectedVersion: await currentOrderVersion(delivery.orderId) });
    }
    await command(fulfillmentTransitions, { orderId: delivery.orderId, command: 'markFailed',
      expectedVersion: await currentOrderVersion(delivery.orderId), reason: 'recipient unavailable' });
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId: delivery.orderId,
      command: 'markFulfilled', expectedVersion: await currentOrderVersion(delivery.orderId) }),
      (error) => errorCode(error) === 'FULFILLMENT_TRANSITION_NOT_ALLOWED');
    await command(fulfillmentTransitions, { orderId: delivery.orderId, command: 'retryDispatch',
      expectedVersion: await currentOrderVersion(delivery.orderId), reason: 'recipient confirmed retry' });
    await command(fulfillmentTransitions, { orderId: delivery.orderId, command: 'markFulfilled',
      expectedVersion: await currentOrderVersion(delivery.orderId) });
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId: delivery.orderId,
      command: 'startPreparing', expectedVersion: await currentOrderVersion(delivery.orderId) }),
      (error) => errorCode(error) === 'FULFILLMENT_TRANSITION_NOT_ALLOWED');

    const cancelled = await makeOrder({ paymentStatus: 'approved' });
    await command(orderTransitions, { orderId: cancelled.orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(cancelled.orderId) });
    await command(fulfillmentTransitions, { orderId: cancelled.orderId, command: 'cancelFulfillment',
      expectedVersion: await currentOrderVersion(cancelled.orderId), reason: 'stock inspection failed' });
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId: cancelled.orderId,
      command: 'markReady', expectedVersion: await currentOrderVersion(cancelled.orderId) }),
      (error) => errorCode(error) === 'FULFILLMENT_TRANSITION_NOT_ALLOWED');

    const fresh = await makeOrder();
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId: fresh.orderId,
      command: 'startPreparing', expectedVersion: await currentOrderVersion(fresh.orderId) }),
      (error) => errorCode(error) === 'FULFILLMENT_ORDER_NOT_CONFIRMED');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM fulfillment_status_history
      WHERE order_id=$1 AND command IN ('markFailed','retryDispatch','markFulfilled')`, [delivery.orderId]), 3);
  });

  test('complete versus cancel and duplicate complete races allow one owner', async () => {
    const { orderId } = await makeOrder({ paymentStatus: 'approved' });
    await command(orderTransitions, { orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(orderId) });
    for (const fulfillmentCommand of ['startPreparing', 'markReady', 'dispatch', 'markFulfilled']) {
      await command(fulfillmentTransitions, { orderId, command: fulfillmentCommand,
        expectedVersion: await currentOrderVersion(orderId) });
    }
    const expectedVersion = await currentOrderVersion(orderId);
    const race = await Promise.allSettled([
      command(orderTransitions, { orderId, command: 'completeOrder', expectedVersion }),
      command(orderTransitions, { orderId, command: 'cancelOrder', expectedVersion,
        reason: 'concurrent cancellation' }),
    ]);
    assert.equal(race.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal((await query('SELECT status FROM orders WHERE id=$1', [orderId])).rows[0].status, 'completed');

    const second = await makeOrder({ paymentStatus: 'approved' });
    await command(orderTransitions, { orderId: second.orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(second.orderId) });
    for (const fulfillmentCommand of ['startPreparing', 'markReady', 'dispatch', 'markFulfilled']) {
      await command(fulfillmentTransitions, { orderId: second.orderId, command: fulfillmentCommand,
        expectedVersion: await currentOrderVersion(second.orderId) });
    }
    const completeVersion = await currentOrderVersion(second.orderId);
    const duplicate = await Promise.allSettled([
      command(orderTransitions, { orderId: second.orderId, command: 'completeOrder', expectedVersion: completeVersion }),
      command(orderTransitions, { orderId: second.orderId, command: 'completeOrder', expectedVersion: completeVersion }),
    ]);
    assert.equal(duplicate.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM order_status_history
      WHERE order_id=$1 AND command='completeOrder'`, [second.orderId]), 1);
  });

  test('completion rejects every invalid fulfillment/payment projection', async () => {
    const fixture = async ({ fulfillment = 'unfulfilled', method = 'transfer', payment = 'approved' }) => {
      const row = await makeOrder({ method, paymentStatus: payment });
      await command(orderTransitions, { orderId: row.orderId, command: 'confirmOrder',
        expectedVersion: await currentOrderVersion(row.orderId) });
      await query('UPDATE orders SET fulfillment_status=$2 WHERE id=$1', [row.orderId, fulfillment]);
      if (fulfillment === 'fulfilled' || fulfillment === 'failed') {
        await query(`UPDATE inventory_reservations SET status='consumed',consumed_at=NOW()
          WHERE order_id=$1 AND status='active'`, [row.orderId]);
      }
      return row;
    };
    for (const input of [
      { fulfillment: 'unfulfilled', method: 'transfer', payment: 'approved', code: 'ORDER_FULFILLMENT_NOT_COMPLETE' },
      { fulfillment: 'failed', method: 'transfer', payment: 'approved', code: 'ORDER_FULFILLMENT_NOT_COMPLETE' },
      { fulfillment: 'fulfilled', method: 'transfer', payment: 'rejected', code: 'ORDER_PAYMENT_GATE_NOT_SATISFIED' },
      { fulfillment: 'fulfilled', method: 'transfer', payment: 'pending', code: 'ORDER_PAYMENT_GATE_NOT_SATISFIED' },
      { fulfillment: 'fulfilled', method: 'cod', payment: 'pending', code: 'ORDER_PAYMENT_GATE_NOT_SATISFIED' },
    ]) {
      const row = await fixture(input);
      await assert.rejects(async () => command(orderTransitions, { orderId: row.orderId,
        command: 'completeOrder', expectedVersion: await currentOrderVersion(row.orderId) }),
        (error) => errorCode(error) === input.code);
      assert.equal((await query('SELECT status FROM orders WHERE id=$1', [row.orderId])).rows[0].status, 'confirmed');
    }
  });

  test('transfer payment gate and approve versus reject race are serialized', async () => {
    const gated = await makeOrder({ method: 'transfer' });
    await command(orderTransitions, { orderId: gated.orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(gated.orderId) });
    const gateVersion = await currentOrderVersion(gated.orderId);
    await assert.rejects(async () => command(fulfillmentTransitions, { orderId: gated.orderId,
      command: 'startPreparing', expectedVersion: gateVersion }),
      (error) => errorCode(error) === 'FULFILLMENT_PAYMENT_GATE_NOT_SATISFIED');
    await command(paymentTransitions, { paymentId: gated.paymentId, command: 'submitPaymentProof',
      expectedVersion: await currentPaymentVersion(gated.paymentId), proof: { payerReference: 'TRX-CLOSURE' } });
    await command(paymentTransitions, { paymentId: gated.paymentId, command: 'startPaymentReview',
      expectedVersion: await currentPaymentVersion(gated.paymentId) });
    const expected = await currentPaymentVersion(gated.paymentId);
    const outcomes = await Promise.allSettled([
      command(paymentTransitions, { paymentId: gated.paymentId, command: 'approvePayment', expectedVersion: expected }),
      command(paymentTransitions, { paymentId: gated.paymentId, command: 'rejectPayment',
        expectedVersion: expected, reason: 'proof mismatch' }),
    ]);
    assert.equal(outcomes.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((entry) => entry.status === 'rejected').length, 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM payment_status_history
      WHERE payment_id=$1 AND command IN ('approvePayment','rejectPayment')`, [gated.paymentId]), 1);
  });

  test('expire versus submit and COD collect versus cancel races commit one payment command', async () => {
    const expiring = await makeOrder({ method: 'transfer' });
    await query(`UPDATE payments SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1`, [expiring.paymentId]);
    const paymentVersion = await currentPaymentVersion(expiring.paymentId);
    const expireRace = await Promise.allSettled([
      command(paymentTransitions, { paymentId: expiring.paymentId, command: 'expirePayment',
        expectedVersion: paymentVersion }),
      command(paymentTransitions, { paymentId: expiring.paymentId, command: 'submitPaymentProof',
        expectedVersion: paymentVersion, proof: { payerReference: 'RACE-PROOF' } }),
    ]);
    assert.equal(expireRace.filter((entry) => entry.status === 'fulfilled').length, 1);

    const cod = await makeOrder();
    await command(orderTransitions, { orderId: cod.orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(cod.orderId) });
    for (const fulfillmentCommand of ['startPreparing', 'markReady', 'dispatch', 'markFulfilled']) {
      await command(fulfillmentTransitions, { orderId: cod.orderId, command: fulfillmentCommand,
        expectedVersion: await currentOrderVersion(cod.orderId) });
    }
    const codVersion = await currentPaymentVersion(cod.paymentId);
    const codRace = await Promise.allSettled([
      command(paymentTransitions, { paymentId: cod.paymentId, command: 'collectCodPayment',
        expectedVersion: codVersion, proof: { collectionReference: 'COD-RACE' } }),
      command(paymentTransitions, { paymentId: cod.paymentId, command: 'cancelPayment',
        expectedVersion: codVersion, reason: 'collection cancelled' }),
    ]);
    assert.equal(codRace.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM payment_status_history
      WHERE payment_id=$1 AND command IN ('collectCodPayment','cancelPayment')`, [cod.paymentId]), 1);
  });

  test('payment-gate override requires dedicated permission and reason', async () => {
    const { orderId } = await makeOrder({ method: 'transfer' });
    await command(orderTransitions, { orderId, command: 'confirmOrder',
      expectedVersion: await currentOrderVersion(orderId) });
    const base = { storeId: ids.store, orderId, command: 'overrideStartPreparing',
      expectedVersion: await currentOrderVersion(orderId), idempotencyKey: randomUUID(), context };
    await assert.rejects(() => fulfillmentTransitions.execute({ ...base,
      actor: { ...actor, permissions: ['orders:write'] }, reason: 'legacy broad permission' }),
      (error) => errorCode(error) === 'COMMERCIAL_PERMISSION_DENIED');
    await assert.rejects(() => fulfillmentTransitions.execute({ ...base, idempotencyKey: randomUUID(),
      actor: { ...actor, permissions: ['orders:override-payment-gate'] } }),
      (error) => errorCode(error) === 'COMMERCIAL_OVERRIDE_REASON_REQUIRED');
    const result = await fulfillmentTransitions.execute({ ...base, idempotencyKey: randomUUID(),
      actor: { ...actor, permissions: ['orders:override-payment-gate'] }, reason: 'operator accepted transfer risk' });
    assert.equal(result.fulfillmentStatus, 'preparing');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM fulfillment_status_history
      WHERE order_id=$1 AND override_permission='orders:override-payment-gate'`, [orderId]), 1);
  });

  test('cancellation releases inventory and coupon exactly once under retry', async () => {
    const { orderId } = await makeOrder();
    const couponId = randomUUID();
    await query(`INSERT INTO coupons
      (id,store_id,code,discount_type,discount_value,min_order_amount,max_uses,used_count,is_active,
       per_customer_limit,currency_code,included_product_ids,excluded_product_ids,included_category_ids,excluded_category_ids)
      VALUES ($1,$2,$3,'fixed',10,0,5,0,TRUE,2,'YER','{}','{}','{}','{}')`,
      [couponId, ids.store, `C${couponId.replaceAll('-', '').slice(0,12)}`]);
    const consumeInput = { storeId: ids.store, couponId, orderId, customerId: ids.customer,
      discountAmount: 10, currencyCode: 'YER', subtotal: 100,
      productIds: [ids.product], categoryIds: [] };
    await tx((client) => promotions.consumeCouponInTransaction(client, consumeInput));
    await tx((client) => promotions.consumeCouponInTransaction(client, consumeInput));
    assert.equal(await scalar('SELECT used_count::int value FROM coupons WHERE id=$1', [couponId]), 1);
    assert.equal(await scalar('SELECT COUNT(*)::int value FROM coupon_usages WHERE coupon_id=$1', [couponId]), 1);
    const expectedVersion = await currentOrderVersion(orderId);
    const replayInput = { storeId: ids.store, orderId, command: 'cancelOrder', expectedVersion,
      reason: 'customer requested cancellation', idempotencyKey: randomUUID(), actor, context };
    const first = await orderTransitions.transition(replayInput);
    const replay = await orderTransitions.transition(replayInput);
    assert.deepEqual(replay, first);
    assert.equal(await scalar('SELECT used_count::int value FROM coupons WHERE id=$1', [couponId]), 0);
    assert.equal((await query('SELECT status FROM coupon_usages WHERE coupon_id=$1', [couponId])).rows[0].status, 'reversed');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservations
      WHERE order_id=$1 AND status='active'`, [orderId]), 0);
  });

  test('inventory consume/release race, expiration, and non-negative projections', async () => {
    const raced = await makeOrder();
    const consume = () => tx((client) => inventory.confirmReservedOrderItems(client, {
      storeId: ids.store, orderId: raced.orderId, actorId: ids.user,
      items: [{ variantId: ids.variant, quantity: 1, sku: 'CLOSURE-SKU' }],
    }));
    const release = () => tx((client) => inventory.releaseOrderReservations(client, {
      storeId: ids.store, orderId: raced.orderId, reason: 'consume-release-race',
      actorId: ids.user, actorType: 'admin',
    }));
    await Promise.allSettled([consume(), release()]);
    const reservation = (await query(`SELECT status FROM inventory_reservations
      WHERE order_id=$1`, [raced.orderId])).rows[0];
    assert.ok(['consumed','released'].includes(reservation.status));
    const stock = (await query(`SELECT quantity,reserved_quantity FROM warehouse_inventory
      WHERE store_id=$1 AND variant_id=$2`, [ids.store, ids.variant])).rows[0];
    assert.ok(stock.quantity >= 0 && stock.reserved_quantity >= 0 && stock.reserved_quantity <= stock.quantity);

    const expiring = await makeOrder();
    await query(`UPDATE inventory_reservations SET expires_at=NOW()-INTERVAL '1 minute'
      WHERE order_id=$1`, [expiring.orderId]);
    const released = await Promise.all([
      inventory.releaseExpiredReservations(ids.store), inventory.releaseExpiredReservations(ids.store),
    ]);
    assert.equal(released[0] + released[1], 1);
    assert.equal((await query(`SELECT status FROM inventory_reservations
      WHERE order_id=$1`, [expiring.orderId])).rows[0].status, 'expired');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservation_events
      WHERE order_id=$1 AND event_type='expired'`, [expiring.orderId]), 1);
  });

  test('loyalty and affiliate reversal retries are idempotent', async () => {
    const { orderId } = await makeOrder({ reserve: false });
    await query(`INSERT INTO loyalty_programs
      (id,store_id,is_enabled,redeem_rate_points,redeem_rate_amount,min_redeem_points,
       redeem_step_points,max_discount_percent) VALUES ($1,$2,TRUE,10,10,10,10,100)
      ON CONFLICT (store_id) DO UPDATE SET is_enabled=TRUE,redeem_rate_points=10,
       redeem_rate_amount=10,min_redeem_points=10,redeem_step_points=10,max_discount_percent=100`,
      [randomUUID(), ids.store]);
    await tx(async (client) => {
      const repository = new LoyaltyRepository(db);
      const wallet = await repository.ensureWalletForUpdate(client, ids.store, ids.customer);
      await repository.updateWallet(client, { walletId: wallet.id, availablePoints: 100,
        lifetimeEarnedPoints: 100, lifetimeRedeemedPoints: 0 });
      await loyalty.applyRedemptionToOrderInTransaction(client, { storeId: ids.store,
        customerId: ids.customer, orderId, pointsToRedeem: 10, totalBeforeDiscount: 100,
        displayDiscountAmount: 10, createdByStoreUserId: ids.user });
    });
    await tx((client) => loyalty.handleOrderCancelledOrReturnedInTransaction(client,
      { storeId: ids.store, orderId, createdByStoreUserId: ids.user }));
    await tx((client) => loyalty.handleOrderCancelledOrReturnedInTransaction(client,
      { storeId: ids.store, orderId, createdByStoreUserId: ids.user }));
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM loyalty_ledger_entries
      WHERE order_id=$1 AND entry_type='reverse'`, [orderId]), 1);

    const affiliateId = randomUUID();
    await query(`INSERT INTO affiliates (id,store_id,name,status,commission_rate_percent,payout_details)
      VALUES ($1,$2,'Closure Affiliate','active',10,'{}')`, [affiliateId, ids.store]);
    await tx((client) => affiliates.createPendingCommissionInTransaction(client, {
      storeId: ids.store, orderId, attribution: { affiliateId, affiliateLinkId: null,
        couponId: null, couponCode: null, attributionType: 'coupon', sessionId: null },
      subtotal: 100, discountTotal: 0,
    }));
    await tx((client) => affiliates.handleOrderStatusChangedInTransaction(client,
      { storeId: ids.store, orderId, nextStatus: 'cancelled' }));
    await tx((client) => affiliates.handleOrderStatusChangedInTransaction(client,
      { storeId: ids.store, orderId, nextStatus: 'cancelled' }));
    assert.equal((await query(`SELECT status FROM affiliate_commissions
      WHERE order_id=$1`, [orderId])).rows[0].status, 'reversed');
  });

  test('manual order replay and edit versus payment approval race are serialized', async () => {
    const input = { lines: [{ variantId: ids.variant, quantity: 1 }], customerId: ids.customer,
      paymentMethod: 'transfer', customerName: 'Closure Customer', customerPhone: '777000000',
      addressLine: 'Manual closure address', city: 'Sanaa', area: 'Test', currencyCode: 'YER' };
    const key = randomUUID();
    const first = await ordersService.createManual({ ...actor, storeId: ids.store, role: 'owner',
      email: 'closure@example.test', fullName: 'Closure Owner', sessionId: randomUUID() },
      input, key, context);
    const replay = await ordersService.createManual({ ...actor, storeId: ids.store, role: 'owner',
      email: 'closure@example.test', fullName: 'Closure Owner', sessionId: randomUUID() },
      input, key, context);
    assert.equal(replay.id, first.id);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM orders WHERE id=$1`, [first.id]), 1);
    const payment = (await query(`UPDATE payments SET status='under_review',submission_version=1
      WHERE order_id=$1 RETURNING id,version::text`, [first.id])).rows[0];
    const user = { ...actor, storeId: ids.store, role: 'owner', email: 'closure@example.test',
      fullName: 'Closure Owner', sessionId: randomUUID() };
    const race = await Promise.allSettled([
      ordersService.updateManual(user, first.id, { expectedVersion: first.version,
        lines: [{ variantId: ids.variant, quantity: 2 }], note: 'concurrent edit' }, randomUUID(), context),
      command(paymentTransitions, { paymentId: payment.id, command: 'approvePayment',
        expectedVersion: Number(payment.version) }),
    ]);
    assert.equal(race.filter((entry) => entry.status === 'fulfilled').length, 1);
  });

  test('financial constraints reject impossible paid/refunded projections', async () => {
    const { paymentId } = await makeOrder();
    for (const sql of [
      `UPDATE payments SET paid_amount=-1 WHERE id=$1`,
      `UPDATE payments SET paid_amount=101 WHERE id=$1`,
      `UPDATE payments SET paid_amount=50,refunded_amount=51 WHERE id=$1`,
      `UPDATE payments SET status='refunded',paid_amount=100,refunded_amount=0 WHERE id=$1`,
      `UPDATE payments SET status='partially_refunded',paid_amount=100,refunded_amount=100 WHERE id=$1`,
    ]) await assert.rejects(() => query(sql, [paymentId]), (error) => error.code === '23514');
  });

  test('coupon + loyalty multi-line allocation is deterministic and reconciles exactly', () => {
    const bases = [{ key: 'line-a', amount: 33.33 }, { key: 'line-b', amount: 33.33 },
      { key: 'line-c', amount: 33.34 }];
    const input = { offerEligibleKeys: ['line-a','line-b'], couponEligibleKeys: ['line-b','line-c'],
      offerDiscount: 5.01, couponDiscount: 7.02, loyaltyDiscount: 3.03 };
    const first = allocateDiscountStages(bases, input);
    const second = allocateDiscountStages(bases, input);
    assert.deepEqual([...first], [...second]);
    assert.equal(Number([...first.values()].reduce((sum, value) => sum + value, 0).toFixed(2)), 15.06);
    assert.ok([...first.entries()].every(([key, value]) => value <= bases.find((line) => line.key === key).amount));
  });

  test('critical payment-method read holds a transaction lock against concurrent disable', async () => {
    const catalog = (await query(`SELECT id FROM payment_method_catalog WHERE code='cod' LIMIT 1`)).rows[0];
    const methodId = randomUUID();
    await query(`INSERT INTO store_payment_methods
      (id,store_id,payment_method_catalog_id,is_enabled,sort_order) VALUES ($1,$2,$3,TRUE,1)`,
      [methodId, ids.store, catalog.id]);
    const reader = await db.db.connect();
    const writer = await db.db.connect();
    try {
      await reader.query('BEGIN');
      await paymentMethods.findEnabledStoreById(ids.store, methodId, reader);
      await writer.query('BEGIN');
      await writer.query(`SET LOCAL lock_timeout='250ms'`);
      await assert.rejects(() => writer.query(
        'UPDATE store_payment_methods SET is_enabled=FALSE WHERE id=$1', [methodId]),
      (error) => error.code === '55P03');
      await writer.query('ROLLBACK');
      await reader.query('COMMIT');
      await query('UPDATE store_payment_methods SET is_enabled=FALSE WHERE id=$1', [methodId]);
    } finally { reader.release(); writer.release(); }
  });

  test('Outbox insertion failure rolls back transition, history, audit, and inventory effects', async () => {
    const { orderId } = await makeOrder();
    const failingOutbox = { enqueueInTransaction: async () => { throw new Error('injected outbox insert failure'); } };
    const failingInventory = new InventoryService(new InventoryRepository(db), failingOutbox, audit);
    const service = new OrderTransitionService(db, commercialIdempotency, invariants,
      failingInventory, promotions, loyalty, affiliates, audit, failingOutbox, metrics);
    const before = await query('SELECT status,version::text FROM orders WHERE id=$1', [orderId]);
    await assert.rejects(async () => command(service, { orderId, command: 'cancelOrder',
      expectedVersion: Number(before.rows[0].version), reason: 'failure injection' }),
      /injected outbox insert failure/u);
    const afterRow = (await query('SELECT status,version::text FROM orders WHERE id=$1', [orderId])).rows[0];
    assert.deepEqual(afterRow, before.rows[0]);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM order_status_history
      WHERE order_id=$1 AND command='cancelOrder'`, [orderId]), 0);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservations
      WHERE order_id=$1 AND status='active'`, [orderId]), 1);
  });

  test('webhook crash and periodic stale Outbox recovery return rows to claimable state', async () => {
    const endpoint = await webhooksRepository.createEndpoint({ storeId: ids.store,
      name: 'Closure endpoint', url: 'http://127.0.0.1:9/closure', secretKey: 'closure-secret',
      events: ['order.created'], isActive: true });
    const outboxId = await outbox.enqueueStandalone({ aggregateType: 'order', aggregateId: randomUUID(),
      eventType: 'order.created', deduplicationKey: `closure.webhook:${randomUUID()}`,
      payload: { storeId: ids.store, orderId: randomUUID() } });
    const event = (await query(`SELECT id,aggregate_type,aggregate_id,event_type,payload,headers,
      attempt_count,deduplication_key,created_at FROM outbox_events WHERE id=$1`, [outboxId])).rows[0];
    await webhooks.processOutboxEvent(event);
    const firstClaim = await webhooksRepository.claimDueDeliveries(1, 'crashed-worker');
    assert.equal(firstClaim.length, 1);
    await query(`UPDATE webhook_deliveries SET locked_at=NOW()-INTERVAL '10 minutes'
      WHERE id=$1`, [firstClaim[0].id]);
    assert.equal(await webhooksRepository.recoverStaleProcessing(1), 1);
    const secondClaim = await webhooksRepository.claimDueDeliveries(1, 'recovery-worker');
    assert.equal(secondClaim[0].id, firstClaim[0].id);
    await query(`UPDATE outbox_events SET status='processing',locked_at=NOW()-INTERVAL '10 minutes',
      locked_by='crashed-outbox' WHERE id=$1`, [outboxId]);
    assert.equal(await outbox.recoverStaleProcessing(1), 1);
    assert.equal((await query('SELECT status FROM outbox_events WHERE id=$1', [outboxId])).rows[0].status, 'pending');
    await query('DELETE FROM webhook_endpoints WHERE id=$1', [endpoint.id]);
  });
});
