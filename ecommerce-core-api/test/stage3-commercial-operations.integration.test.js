const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const databaseUrl = process.env.STAGE3_TEST_DATABASE_URL;

describe('Stage 3 commercial operations - real PostgreSQL', { skip: !databaseUrl }, () => {
  let app;
  let pool;
  let storefront;
  let outbox;
  let inventory;
  let payments;
  let affiliates;
  let loyalty;
  let orders;
  let customers;
  let storePaymentMethodId;

  const STORE = '00000000-0000-4000-8000-000000000100';
  const WAREHOUSE = '30000000-0000-4000-8000-000000000001';
  const ZONE = '30000000-0000-4000-8000-000000000002';
  const METHOD = '30000000-0000-4000-8000-000000000003';
  const request = {
    headers: { 'x-request-id': 'stage3-integration' },
    query: {}, cookies: {}, ip: '127.0.0.1', originalUrl: '/storefront/checkout',
  };
  const authUser = {
    id: '00000000-0000-4000-8000-000000000101', storeId: STORE,
    role: 'owner', email: 'owner@nojoom.local', fullName: 'Stage 3 Owner',
    permissions: ['*'], sessionId: 'stage3-session',
  };
  const context = { requestId:'stage3-integration',ipAddress:'127.0.0.1',userAgent:'node-test' };

  const query = (text, values = []) => pool.query(text, values);
  const scalar = async (text, values = []) => Number((await query(text, values)).rows[0].value);
  const errorCode = (error) => {
    if (typeof error?.getResponse === 'function') return error.getResponse().code;
    return error?.response?.code ?? error?.code ?? error?.message;
  };
  const settledCode = (entry) => entry.status === 'rejected' ? errorCode(entry.reason) : null;

  async function catalog(label, stock = 100, price = 1000) {
    const categoryId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    await query(`INSERT INTO categories (id, store_id, name, slug, name_ar, name_en)
      VALUES ($1,$2,$3,$4,$3,$3)`, [categoryId, STORE, `Category ${label}`, `stage3-${label}-${categoryId}`]);
    await query(`INSERT INTO products
      (id,store_id,category_id,title,slug,status,title_ar,title_en,is_visible,stock_unlimited,weight)
      VALUES ($1,$2,$3,$4,$5,'active',$4,$4,TRUE,FALSE,1)`,
      [productId, STORE, categoryId, `Product ${label}`, `stage3-${label}-${productId}`]);
    await query(`INSERT INTO product_categories (id,store_id,product_id,category_id)
      VALUES ($1,$2,$3,$4)`, [randomUUID(), STORE, productId, categoryId]);
    await query(`INSERT INTO product_variants
      (id,product_id,store_id,title,sku,price,stock_quantity,attributes,is_default,title_ar,title_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,TRUE,$4,$4)`,
      [variantId, productId, STORE, `Variant ${label}`, `S3-${label}-${variantId.slice(0,8)}`,
       price, stock, JSON.stringify({ color: label })]);
    await query(`INSERT INTO warehouse_inventory
      (id,warehouse_id,variant_id,store_id,quantity,reserved_quantity,low_stock_threshold)
      VALUES ($1,$2,$3,$4,$5,0,1)`, [randomUUID(), WAREHOUSE, variantId, STORE, stock]);
    return { categoryId, productId, variantId, stock, price };
  }

  async function cartFor(item, quantity = 1, customerId = null) {
    const cartId = randomUUID();
    await query(`INSERT INTO carts (id,store_id,customer_id,status,currency_code,expires_at)
      VALUES ($1,$2,$3,'open','YER',NOW()+INTERVAL '2 days')`, [cartId, STORE, customerId]);
    await query(`INSERT INTO cart_items
      (id,cart_id,store_id,product_id,variant_id,quantity,unit_price,unit_price_yer)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [randomUUID(), cartId, STORE, item.productId, item.variantId, quantity, item.price]);
    return cartId;
  }

  function checkoutInput(cartId, overrides = {}) {
    return {
      cartId,
      customerName: `Stage3 ${cartId.slice(0,8)}`,
      customerPhone: `77${cartId.replaceAll('-', '').slice(0,7)}`,
      addressLine: 'Stage 3 test address', city: 'Sanaa', area: 'Stage 3 Area',
      shippingZoneId: ZONE, shippingMethodId: METHOD,
      storePaymentMethodId, paymentMethod: 'cod',
      note: `stage3-test:${cartId}`,
      ...overrides,
    };
  }

  async function checkout(cartId, key = randomUUID(), overrides = {}) {
    return storefront.checkout(request, checkoutInput(cartId, overrides), key);
  }

  async function countBusiness(cartId) {
    const row = (await query(`SELECT
      COUNT(DISTINCT o.id)::int AS orders,
      COUNT(DISTINCT p.id)::int AS payments,
      COUNT(DISTINCT r.id)::int AS reservations,
      COUNT(DISTINCT e.id) FILTER (WHERE e.event_type='order.created')::int AS created_events
      FROM carts c LEFT JOIN orders o ON o.cart_id=c.id
      LEFT JOIN payments p ON p.order_id=o.id
      LEFT JOIN inventory_reservations r ON r.order_id=o.id
      LEFT JOIN outbox_events e ON e.aggregate_id=o.id::text
      WHERE c.id=$1 GROUP BY c.id`, [cartId])).rows[0];
    return row ?? { orders: 0, payments: 0, reservations: 0, created_events: 0 };
  }

  async function coupon(input = {}) {
    const id=randomUUID();
    const code=`S3${id.replaceAll('-','').slice(0,14).toUpperCase()}`;
    await query(`INSERT INTO coupons
      (id,store_id,code,affiliate_id,is_free_shipping,discount_type,discount_value,
       min_order_amount,max_uses,is_active,per_customer_limit,maximum_discount,currency_code,
       included_product_ids,excluded_product_ids,included_category_ids,excluded_category_ids)
      VALUES ($1,$2,$3,$4,FALSE,'percent',$5,0,$6,TRUE,$7,$8,'YER',$9,$10,$11,$12)`,
      [id,STORE,code,input.affiliateId??null,input.discountValue??10,input.maxUses??null,
       input.perCustomerLimit??null,input.maximumDiscount??null,input.includedProductIds??[],
       input.excludedProductIds??[],input.includedCategoryIds??[],input.excludedCategoryIds??[]]);
    return {id,code};
  }

  async function withTx(work) {
    const client=await pool.connect();
    try { await client.query('BEGIN'); const value=await work(client); await client.query('COMMIT'); return value; }
    catch(error){ await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  before(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'test';
    process.env.OUTBOX_BASE_BACKOFF_MS = '100';
    require('reflect-metadata');
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    await query(`INSERT INTO warehouses (id,store_id,name,code,is_default,is_active,priority)
      VALUES ($1,$2,'Stage 3 Warehouse','STAGE3',TRUE,TRUE,1)
      ON CONFLICT (id) DO UPDATE SET is_active=TRUE`, [WAREHOUSE, STORE]);
    await query(`INSERT INTO shipping_zones (id,store_id,name,city,fee,is_active)
      VALUES ($1,$2,'Stage 3 Zone','Sanaa',0,TRUE)
      ON CONFLICT (id) DO UPDATE SET is_active=TRUE`, [ZONE, STORE]);
    await query(`INSERT INTO shipping_methods
      (id,store_id,shipping_zone_id,method_type,display_name,is_active,sort_order,config)
      VALUES ($1,$2,$3,'flat_rate','Stage 3 Delivery',TRUE,1,'{"cost":100}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET is_active=TRUE,config=EXCLUDED.config`, [METHOD, STORE, ZONE]);
    storePaymentMethodId = (await query(`SELECT spm.id FROM store_payment_methods spm
      JOIN payment_method_catalog pmc ON pmc.id=spm.payment_method_catalog_id
      WHERE spm.store_id=$1 AND spm.is_enabled=TRUE AND pmc.code='cod' LIMIT 1`, [STORE])).rows[0].id;

    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { StorefrontService } = require('../dist/storefront/storefront.service');
    const { OutboxService } = require('../dist/messaging/outbox.service');
    const { InventoryService } = require('../dist/inventory/inventory.service');
    const { PaymentsService } = require('../dist/payments/payments.service');
    const { AffiliatesService } = require('../dist/affiliates/affiliates.service');
    const { LoyaltyService } = require('../dist/loyalty/loyalty.service');
    const { OrdersService } = require('../dist/orders/orders.service');
    const { CustomersService } = require('../dist/customers/customers.service');
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
    storefront = app.get(StorefrontService);
    outbox = app.get(OutboxService);
    inventory = app.get(InventoryService);
    payments = app.get(PaymentsService);
    affiliates = app.get(AffiliatesService);
    loyalty = app.get(LoyaltyService);
    orders = app.get(OrdersService);
    customers = app.get(CustomersService);
    await query(`UPDATE stores SET affiliate_enabled=TRUE,affiliate_min_payout=0 WHERE id=$1`,[STORE]);
  });

  after(async () => {
    delete process.env.STAGE3_CHECKOUT_FAILURE_POINT;
    if (app) await app.close();
    if (pool) await pool.end();
  });

  test('17.1 Normal order', async () => {
    const item = await catalog('normal');
    const cartId = await cartFor(item, 2);
    const result = await checkout(cartId);
    const effects = await countBusiness(cartId);
    assert.equal(effects.orders, 1);
    assert.equal(effects.payments, 1);
    assert.equal(effects.reservations, 1);
    assert.equal(effects.created_events, 1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM order_items WHERE order_id=$1`, [result.orderId]), 1);
    assert.equal((await query(`SELECT status,checked_out_order_id FROM carts WHERE id=$1`, [cartId])).rows[0].status, 'checked_out');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM idempotency_keys WHERE order_id=$1 AND status='completed'`, [result.orderId]), 1);
    const totals = (await query(`SELECT subtotal,shipping_fee,discount_total,total FROM orders WHERE id=$1`, [result.orderId])).rows[0];
    assert.equal(Number(totals.total), Number(totals.subtotal)+Number(totals.shipping_fee)-Number(totals.discount_total));
  });

  test('17.2 Same-key sequential retry', async () => {
    const item = await catalog('seq');
    const cartId = await cartFor(item);
    const key = randomUUID();
    const first = await checkout(cartId, key);
    const second = await checkout(cartId, key);
    assert.deepEqual(second, first);
    assert.deepEqual(await countBusiness(cartId), { orders: 1, payments: 1, reservations: 1, created_events: 1 });
  });

  test('17.3 Same-key concurrent retry', async () => {
    const item = await catalog('samekey');
    const cartId = await cartFor(item);
    const key = randomUUID();
    const results = await Promise.allSettled([checkout(cartId,key),checkout(cartId,key)]);
    assert.equal(results.filter((r)=>r.status==='fulfilled').length, 2);
    assert.equal(results[0].value.orderId, results[1].value.orderId);
    assert.equal((await countBusiness(cartId)).orders, 1);
  });

  test('17.4 Same-key changed payload', async () => {
    const item = await catalog('mismatch');
    const cartId = await cartFor(item);
    const key = randomUUID();
    await checkout(cartId,key);
    await assert.rejects(() => checkout(cartId,key,{ note:'changed-payload' }),
      (error) => error.getStatus() === 409 && errorCode(error) === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
    assert.equal((await countBusiness(cartId)).orders, 1);
  });

  test('17.5 Same-cart different-key race', async () => {
    const item = await catalog('cart-race');
    const cartId = await cartFor(item);
    const results = await Promise.allSettled([checkout(cartId),checkout(cartId)]);
    assert.equal(results.filter((r)=>r.status==='fulfilled').length, 1);
    assert.ok(results.some((r)=>settledCode(r)==='CART_ALREADY_CHECKED_OUT'));
    assert.equal((await countBusiness(cartId)).orders, 1);
  });

  test('17.6 Last-item race', async () => {
    const item = await catalog('last-item',1);
    const carts = await Promise.all([cartFor(item),cartFor(item)]);
    const results = await Promise.allSettled(carts.map((cartId)=>checkout(cartId)));
    assert.equal(results.filter((r)=>r.status==='fulfilled').length, 1);
    const inventoryRow = (await query(`SELECT quantity,reserved_quantity FROM warehouse_inventory WHERE variant_id=$1`,[item.variantId])).rows[0];
    assert.equal(inventoryRow.reserved_quantity,1);
    assert.ok(inventoryRow.quantity-inventoryRow.reserved_quantity >= 0);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_reservations WHERE variant_id=$1 AND status='active'`,[item.variantId]),1);
    const losingCart = carts[results.findIndex((r)=>r.status==='rejected')];
    assert.deepEqual(await countBusiness(losingCart), { orders: 0, payments: 0, reservations: 0, created_events: 0 });
  });

  for (const [number, point, label] of [
    ['17.7','after_order_insert','Failure after order insert'],
    ['17.8','after_payment_insert','Failure after payment insert'],
    ['17.9','outbox_insert','Outbox insertion failure'],
  ]) {
    test(`${number} ${label}`, async () => {
      const item = await catalog(point);
      const cartId = await cartFor(item);
      process.env.STAGE3_CHECKOUT_FAILURE_POINT = point;
      await assert.rejects(() => checkout(cartId));
      delete process.env.STAGE3_CHECKOUT_FAILURE_POINT;
      assert.deepEqual(await countBusiness(cartId), { orders: 0, payments: 0, reservations: 0, created_events: 0 });
      assert.equal((await query(`SELECT status FROM carts WHERE id=$1`,[cartId])).rows[0].status,'open');
    });
  }

  test('17.10 Outbox worker failure and retry', async () => {
    await query(`UPDATE outbox_events SET next_attempt_at=NOW()+INTERVAL '1 day' WHERE status='pending'`);
    const id = await outbox.enqueueStandalone({ aggregateType:'stage3',aggregateId:randomUUID(),
      eventType:'stage3.retry',deduplicationKey:`stage3.retry:${randomUUID()}`,payload:{safe:true} });
    const originalPublisher = outbox.publisher;
    outbox.publisher = { publish: async () => { throw new Error('broker unavailable token=secret-value'); } };
    await outbox.publishPending(1, undefined, 'stage3-failing-worker');
    let row = (await query(`SELECT status,attempt_count,next_attempt_at,locked_by,last_error FROM outbox_events WHERE id=$1`,[id])).rows[0];
    assert.equal(row.status,'pending');
    assert.equal(row.attempt_count,1);
    assert.equal(row.locked_by,null);
    assert.ok(!row.last_error.includes('secret-value'));
    await query(`UPDATE outbox_events SET next_attempt_at=NOW() WHERE id=$1`,[id]);
    let publishes=0;
    outbox.publisher = { publish: async () => { publishes++; } };
    await outbox.publishPending(1, undefined, 'stage3-success-worker');
    row=(await query(`SELECT status,attempt_count FROM outbox_events WHERE id=$1`,[id])).rows[0];
    assert.equal(row.status,'published');
    assert.equal(publishes,1);
    outbox.publisher=originalPublisher;
  });

  test('17.11 Two Outbox workers do not double-claim', async () => {
    await query(`UPDATE outbox_events SET next_attempt_at=NOW()+INTERVAL '1 day' WHERE status='pending'`);
    const prefix=`stage3.claim:${randomUUID()}`;
    for(let i=0;i<12;i++) await outbox.enqueueStandalone({aggregateType:'stage3',aggregateId:randomUUID(),
      eventType:'stage3.claim',deduplicationKey:`${prefix}:${i}`,payload:{i}});
    const [a,b]=await Promise.all([outbox.claimBatch(12,'claimer-a'),outbox.claimBatch(12,'claimer-b')]);
    const ids=[...a,...b].map((row)=>row.id);
    assert.equal(new Set(ids).size,ids.length);
    assert.equal(ids.length,12);
    await query(`DELETE FROM outbox_events WHERE deduplication_key LIKE $1`,[`${prefix}%`]);
  });

  test('17.12 Last coupon use race', async () => {
    const item=await catalog('coupon-last');
    const promo=await coupon({maxUses:1,includedProductIds:[item.productId]});
    const carts=await Promise.all([cartFor(item),cartFor(item)]);
    const results=await Promise.allSettled(carts.map((id)=>checkout(id,randomUUID(),{couponCode:promo.code})));
    assert.equal(results.filter((r)=>r.status==='fulfilled').length,1);
    assert.ok(results.some((r)=>settledCode(r)==='COUPON_USAGE_LIMIT_REACHED' || settledCode(r)==='CHECKOUT_FAILED'));
    assert.equal(await scalar(`SELECT used_count::int value FROM coupons WHERE id=$1`,[promo.id]),1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM coupon_usages WHERE coupon_id=$1 AND status='consumed'`,[promo.id]),1);
  });

  test('17.13 Per-customer coupon limit race', async () => {
    const item=await catalog('coupon-customer');
    const customerId=randomUUID();
    const phone=`76${customerId.replaceAll('-','').slice(0,7)}`;
    await query(`INSERT INTO customers (id,store_id,full_name,phone) VALUES ($1,$2,'Coupon Customer',$3)`,[customerId,STORE,phone]);
    const promo=await coupon({perCustomerLimit:1});
    const carts=await Promise.all([cartFor(item,1,customerId),cartFor(item,1,customerId)]);
    const overrides={couponCode:promo.code,customerName:'Coupon Customer',customerPhone:phone};
    const results=await Promise.allSettled(carts.map((id)=>checkout(id,randomUUID(),overrides)));
    assert.equal(results.filter((r)=>r.status==='fulfilled').length,1);
    assert.ok(results.some((r)=>settledCode(r)==='COUPON_CUSTOMER_LIMIT_REACHED'));
    assert.equal(await scalar(`SELECT consumed_count::int value FROM coupon_customer_counters
      WHERE coupon_id=$1 AND customer_id=$2`,[promo.id,customerId]),1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM coupon_usages WHERE coupon_id=$1`,[promo.id]),1);
  });

  test('17.14 Loyalty redemption race', async () => {
    const suffix=randomUUID().replaceAll('-','').slice(0,8);
    const registered=await customers.register({fullName:'Loyalty Race',phone:`75${suffix.slice(0,7)}`,
      email:`loyalty-${suffix}@example.test`,password:'StrongPassword123!'},STORE,context);
    const customerId=registered.customer.id;
    await query(`INSERT INTO loyalty_programs
      (id,store_id,is_enabled,redeem_rate_points,redeem_rate_amount,min_redeem_points,redeem_step_points,max_discount_percent)
      VALUES ($1,$2,TRUE,100,100,100,100,100)
      ON CONFLICT (store_id) DO UPDATE SET is_enabled=TRUE,redeem_rate_points=100,
        redeem_rate_amount=100,min_redeem_points=100,redeem_step_points=100,max_discount_percent=100`,
      [randomUUID(),STORE]);
    await query(`INSERT INTO customer_loyalty_wallets
      (id,store_id,customer_id,available_points,lifetime_earned_points)
      VALUES ($1,$2,$3,100,100) ON CONFLICT (store_id,customer_id)
      DO UPDATE SET available_points=100,lifetime_earned_points=100,lifetime_redeemed_points=0`,
      [randomUUID(),STORE,customerId]);
    const item=await catalog('loyalty-race');
    const carts=await Promise.all([cartFor(item,1,customerId),cartFor(item,1,customerId)]);
    const override={customerAccessToken:registered.accessToken,pointsToRedeem:100,
      customerName:registered.customer.fullName,customerPhone:registered.customer.phone};
    const results=await Promise.allSettled(carts.map((id)=>checkout(id,randomUUID(),override)));
    assert.equal(results.filter((r)=>r.status==='fulfilled').length,1);
    assert.ok(results.some((r)=>settledCode(r)==='LOYALTY_INSUFFICIENT_POINTS'));
    const wallet=(await query(`SELECT available_points,lifetime_redeemed_points FROM customer_loyalty_wallets
      WHERE store_id=$1 AND customer_id=$2`,[STORE,customerId])).rows[0];
    assert.equal(wallet.available_points,0);
    assert.equal(wallet.lifetime_redeemed_points,100);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM loyalty_ledger_entries
      WHERE customer_id=$1 AND entry_type='redeem'`,[customerId]),1);
    const committed=(await query(`SELECT points_redeemed,points_discount_amount_yer FROM orders WHERE customer_id=$1`,[customerId])).rows;
    assert.ok(committed.every((row)=>row.points_redeemed===100 && Number(row.points_discount_amount_yer)===100));
  });

  test('17.15 Payment double approval', async () => {
    const item=await catalog('payment-double');
    const cartId=await cartFor(item);
    const result=await checkout(cartId);
    const payment=(await query(`SELECT id FROM payments WHERE order_id=$1`,[result.orderId])).rows[0];
    await query(`UPDATE payments SET status='under_review' WHERE id=$1`,[payment.id]);
    const outcomes=await Promise.allSettled([
      payments.updateStatus(authUser,payment.id,{status:'approved',reviewNote:'stage3'},context),
      payments.updateStatus(authUser,payment.id,{status:'approved',reviewNote:'stage3'},context),
    ]);
    assert.equal(outcomes.filter((r)=>r.status==='fulfilled').length,2);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM payment_status_history
      WHERE payment_id=$1 AND from_status='under_review' AND to_status='approved'`,[payment.id]),1);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events
      WHERE deduplication_key=$1`,[`payment.status_changed:${payment.id}:under_review:approved`]),1);
  });

  test('17.16 Payment approval/rejection race', async () => {
    const item=await catalog('payment-terminal');
    const cartId=await cartFor(item);
    const result=await checkout(cartId);
    const payment=(await query(`SELECT id FROM payments WHERE order_id=$1`,[result.orderId])).rows[0];
    await query(`UPDATE payments SET status='under_review' WHERE id=$1`,[payment.id]);
    const outcomes=await Promise.allSettled([
      payments.updateStatus(authUser,payment.id,{status:'approved'},context),
      payments.updateStatus(authUser,payment.id,{status:'rejected'},context),
    ]);
    assert.equal(outcomes.filter((r)=>r.status==='fulfilled').length,1);
    assert.equal(outcomes.filter((r)=>r.status==='rejected').length,1);
    const status=(await query(`SELECT status FROM payments WHERE id=$1`,[payment.id])).rows[0].status;
    assert.ok(['approved','rejected'].includes(status));
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM payment_status_history WHERE payment_id=$1`,[payment.id]),1);
  });

  test('17.17 Reservation consume retry', async () => {
    const item=await catalog('consume',5);
    const cartId=await cartFor(item,2);
    const result=await checkout(cartId);
    const input={storeId:STORE,orderId:result.orderId,actorId:authUser.id,
      items:[{variantId:item.variantId,quantity:2,sku:'consume'}]};
    await withTx((db)=>inventory.confirmReservedOrderItems(db,input));
    await withTx((db)=>inventory.confirmReservedOrderItems(db,input));
    const stock=(await query(`SELECT quantity,reserved_quantity FROM warehouse_inventory WHERE variant_id=$1`,[item.variantId])).rows[0];
    assert.deepEqual(stock,{quantity:3,reserved_quantity:0});
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM inventory_movements
      WHERE order_id=$1 AND movement_type='sale'`,[result.orderId]),1);
    assert.equal((await query(`SELECT status FROM inventory_reservations WHERE order_id=$1`,[result.orderId])).rows[0].status,'consumed');
  });

  test('17.18 Reservation release retry', async () => {
    const item=await catalog('release',5);
    const cartId=await cartFor(item,2);
    const result=await checkout(cartId);
    await withTx((db)=>inventory.releaseOrderReservations(db,{storeId:STORE,orderId:result.orderId,reason:'stage3'}));
    await withTx((db)=>inventory.releaseOrderReservations(db,{storeId:STORE,orderId:result.orderId,reason:'stage3'}));
    assert.equal(await scalar(`SELECT reserved_quantity::int value FROM warehouse_inventory WHERE variant_id=$1`,[item.variantId]),0);
    assert.equal((await query(`SELECT status FROM inventory_reservations WHERE order_id=$1`,[result.orderId])).rows[0].status,'released');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events
      WHERE deduplication_key=$1`,[`inventory.reservation_released:${result.orderId}:stage3`]),1);
  });

  test('17.19 Reservation expiration with two workers', async () => {
    const item=await catalog('expire',5);
    const cartId=await cartFor(item,2);
    const result=await checkout(cartId);
    await query(`UPDATE inventory_reservations SET expires_at=NOW()-INTERVAL '1 minute' WHERE order_id=$1`,[result.orderId]);
    const [a,b]=await Promise.all([inventory.releaseExpiredReservations(STORE),inventory.releaseExpiredReservations(STORE)]);
    assert.equal(a+b,1);
    assert.equal(await scalar(`SELECT reserved_quantity::int value FROM warehouse_inventory WHERE variant_id=$1`,[item.variantId]),0);
    assert.equal((await query(`SELECT status FROM inventory_reservations WHERE order_id=$1`,[result.orderId])).rows[0].status,'expired');
  });

  test('17.20 Order cancellation releases active reservations once', async () => {
    const item=await catalog('cancel',5);
    const cartId=await cartFor(item,2);
    const result=await checkout(cartId);
    await orders.updateStatus(authUser,result.orderId,{status:'cancelled',note:'stage3 cancel'},context);
    assert.equal(await scalar(`SELECT reserved_quantity::int value FROM warehouse_inventory WHERE variant_id=$1`,[item.variantId]),0);
    assert.equal((await query(`SELECT status FROM inventory_reservations WHERE order_id=$1`,[result.orderId])).rows[0].status,'released');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM outbox_events
      WHERE event_type='inventory.reservation_released' AND aggregate_id=$1`,[result.orderId]),1);
  });

  test('17.21 Affiliate lifecycle and paid clawback', async () => {
    const affiliateId=randomUUID();
    await query(`INSERT INTO affiliates
      (id,store_id,name,status,commission_rate_percent,payout_details)
      VALUES ($1,$2,'Stage 3 Affiliate','active',10,'{}'::jsonb)`,[affiliateId,STORE]);
    const promo=await coupon({affiliateId,maxUses:10});
    const item=await catalog('affiliate');
    const cartId=await cartFor(item);
    const result=await checkout(cartId,randomUUID(),{couponCode:promo.code});
    let commission=(await query(`SELECT id,status FROM affiliate_commissions WHERE order_id=$1`,[result.orderId])).rows[0];
    assert.equal(commission.status,'pending');
    const paymentId=(await query(`SELECT id FROM payments WHERE order_id=$1`,[result.orderId])).rows[0].id;
    await payments.updateStatus(authUser,paymentId,{status:'approved'},context);
    for(const status of ['confirmed','preparing','completed']) {
      await orders.updateStatus(authUser,result.orderId,{status,note:`stage3 ${status}`},context);
    }
    commission=(await query(`SELECT id,status FROM affiliate_commissions WHERE order_id=$1`,[result.orderId])).rows[0];
    assert.equal(commission.status,'approved');
    await query(`UPDATE affiliate_commissions SET return_window_ends_at=NOW()-INTERVAL '1 second' WHERE id=$1`,[commission.id]);
    await Promise.all([affiliates.advancePayableCommissions(),affiliates.advancePayableCommissions()]);
    assert.equal((await query(`SELECT status FROM affiliate_commissions WHERE id=$1`,[commission.id])).rows[0].status,'payable');
    const batch=await affiliates.createPayoutBatch(authUser,{note:'stage3 payout'},context);
    await affiliates.markPayoutBatchPaid(authUser,batch.id,{note:'stage3 paid'},context);
    assert.equal((await query(`SELECT status FROM affiliate_commissions WHERE id=$1`,[commission.id])).rows[0].status,'paid');
    await Promise.all([
      payments.updateStatus(authUser,paymentId,{status:'refunded'},context),
      payments.updateStatus(authUser,paymentId,{status:'refunded'},context),
    ]);
    assert.equal((await query(`SELECT status FROM affiliate_commissions WHERE id=$1`,[commission.id])).rows[0].status,'reversed');
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM affiliate_commission_adjustments
      WHERE commission_id=$1`,[commission.id]),1);
  });

  test('17.22 Loyalty pending earn, availability, and reversal', async () => {
    const suffix=randomUUID().replaceAll('-','').slice(0,8);
    const registered=await customers.register({fullName:'Earn Customer',phone:`74${suffix.slice(0,7)}`,
      email:`earn-${suffix}@example.test`,password:'StrongPassword123!'},STORE,context);
    const customerId=registered.customer.id;
    const program=(await query(`UPDATE loyalty_programs SET is_enabled=TRUE WHERE store_id=$1 RETURNING id`,[STORE])).rows[0];
    await query(`UPDATE loyalty_earn_rules SET is_active=FALSE WHERE store_id=$1`,[STORE]);
    await query(`INSERT INTO loyalty_earn_rules
      (id,store_id,program_id,name,rule_type,earn_rate,min_order_amount,is_active,priority)
      VALUES ($1,$2,$3,'Stage 3 earn','order_percent',10,0,TRUE,1)`,[randomUUID(),STORE,program.id]);
    const item=await catalog('loyalty-earn',10,1000);
    const cartId=await cartFor(item,1,customerId);
    const result=await checkout(cartId,randomUUID(),{customerAccessToken:registered.accessToken,
      customerName:registered.customer.fullName,customerPhone:registered.customer.phone});
    const paymentId=(await query(`SELECT id FROM payments WHERE order_id=$1`,[result.orderId])).rows[0].id;
    await payments.updateStatus(authUser,paymentId,{status:'approved'},context);
    for(const status of ['confirmed','preparing','completed']) {
      await orders.updateStatus(authUser,result.orderId,{status,note:`stage3 ${status}`},context);
    }
    const earn=(await query(`SELECT id,status,points_delta FROM loyalty_ledger_entries
      WHERE order_id=$1 AND entry_type='earn'`,[result.orderId])).rows[0];
    assert.equal(earn.status,'pending');
    assert.equal(await scalar(`SELECT available_points::int value FROM customer_loyalty_wallets
      WHERE customer_id=$1`,[customerId]),0);
    await query(`UPDATE loyalty_ledger_entries SET available_at=NOW()-INTERVAL '1 second' WHERE id=$1`,[earn.id]);
    const activated=await Promise.all([loyalty.makePendingEarnsAvailable(),loyalty.makePendingEarnsAvailable()]);
    assert.equal(activated[0]+activated[1],1);
    assert.equal(await scalar(`SELECT available_points::int value FROM customer_loyalty_wallets
      WHERE customer_id=$1`,[customerId]),earn.points_delta);
    await orders.updateStatus(authUser,result.orderId,{status:'returned',note:'stage3 returned'},context);
    await Promise.all([
      withTx((db)=>loyalty.handleOrderCancelledOrReturnedInTransaction(db,{storeId:STORE,orderId:result.orderId,createdByStoreUserId:authUser.id})),
      withTx((db)=>loyalty.handleOrderCancelledOrReturnedInTransaction(db,{storeId:STORE,orderId:result.orderId,createdByStoreUserId:authUser.id})),
    ]);
    assert.equal(await scalar(`SELECT available_points::int value FROM customer_loyalty_wallets
      WHERE customer_id=$1`,[customerId]),0);
    assert.equal(await scalar(`SELECT COUNT(*)::int value FROM loyalty_ledger_entries
      WHERE source_ledger_id=$1 AND entry_type='reverse'`,[earn.id]),1);
    const ledgerSum=await scalar(`SELECT COALESCE(SUM(points_delta),0)::int value FROM loyalty_ledger_entries
      WHERE customer_id=$1 AND status IN ('available','reversed')`,[customerId]);
    assert.equal(ledgerSum,0);
  });

  test('17.23 Snapshot immutability', async () => {
    const item=await catalog('snapshot',5,1234);
    const oldMedia=randomUUID();
    const newMedia=randomUUID();
    await query(`INSERT INTO media_assets (id,store_id,object_key,public_url,mime_type,file_size_bytes)
      VALUES ($1,$2,'stage3-old','https://example.test/old.png','image/png',10),
             ($3,$2,'stage3-new','https://example.test/new.png','image/png',10)`,[oldMedia,STORE,newMedia]);
    const imageId=randomUUID();
    await query(`INSERT INTO product_images
      (id,store_id,product_id,variant_id,media_asset_id,alt_text,sort_order,is_primary)
      VALUES ($1,$2,$3,$4,$5,'old image',0,TRUE)`,[imageId,STORE,item.productId,item.variantId,oldMedia]);
    const cartId=await cartFor(item);
    const result=await checkout(cartId);
    const before=(await orders.getById(authUser,result.orderId)).items[0];
    await query(`UPDATE products SET title='Mutated product',title_ar='Mutated product',title_en='Mutated product' WHERE id=$1`,[item.productId]);
    await query(`UPDATE product_variants SET title='Mutated variant',title_ar='Mutated variant',title_en='Mutated variant',
      sku=$2,price=9999,attributes='{"changed":true}'::jsonb WHERE id=$1`,
      [item.variantId,`MUTATED-${item.variantId.slice(0,8)}`]);
    await query(`UPDATE product_images SET media_asset_id=$2,alt_text='new image' WHERE id=$1`,[imageId,newMedia]);
    const afterItem=(await orders.getById(authUser,result.orderId)).items[0];
    assert.deepEqual(afterItem,before);
    assert.equal(before.productName,'Product snapshot');
    assert.equal(before.variantName,'Variant snapshot');
    assert.ok(before.sku.startsWith('S3-snapshot-'));
    assert.equal(before.unitPrice,1234);
    assert.equal(before.productImage,'https://example.test/old.png');
    assert.deepEqual(before.attributes,{color:'snapshot'});
  });
});
