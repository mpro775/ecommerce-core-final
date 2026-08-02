const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const databaseUrl = process.env.STAGE3_TEST_DATABASE_URL;

describe('Manual Order Coupon Scope', { skip: !databaseUrl }, () => {
  let app;
  let pool;
  let orders;
  let storefront;

  const STORE = '00000000-0000-4000-8000-000000000100';
  const WAREHOUSE = '30000000-0000-4000-8000-000000000001';
  const ZONE = '30000000-0000-4000-8000-000000000002';
  const METHOD = '30000000-0000-4000-8000-000000000003';
  const context = { requestId:'stage3-integration',ipAddress:'127.0.0.1',userAgent:'node-test' };
  const authUser = {
    id: '00000000-0000-4000-8000-000000000101', storeId: STORE,
    role: 'owner', email: 'owner@nojoom.local', fullName: 'Stage 3 Owner',
    permissions: ['*'], sessionId: 'stage3-session',
  };

  const query = (text, values = []) => pool.query(text, values);
  
  async function catalog(label, stock = 100, price = 1000) {
    const categoryId = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    await query(`INSERT INTO categories (id, store_id, name, slug, name_ar, name_en)
      VALUES ($1,$2,$3,$4,$3,$3)`, [categoryId, STORE, `Category ${label}`, `manual-${label}-${categoryId}`]);
    await query(`INSERT INTO products
      (id,store_id,category_id,title,slug,status,title_ar,title_en,is_visible,stock_unlimited,weight)
      VALUES ($1,$2,$3,$4,$5,'active',$4,$4,true,false,1.5)`,
      [productId, STORE, categoryId, `Product ${label}`, `manual-${label}-${productId}`]);
    await query(`INSERT INTO product_variants
      (id,store_id,product_id,title,sku,price,stock_quantity,title_ar,title_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$4,$4)`,
      [variantId, STORE, productId, `Variant ${label}`, `MANUAL-${label.toUpperCase()}`, price, stock]);
    await query(`INSERT INTO inventory_levels (store_id, warehouse_id, variant_id, available)
      VALUES ($1,$2,$3,$4)`, [STORE, WAREHOUSE, variantId, stock]);
    return { categoryId, productId, variantId };
  }

  async function createCoupon(overrides = {}) {
    const id = randomUUID();
    const code = randomUUID().substring(0, 8).toUpperCase();
    await query(`INSERT INTO coupons (
      id, store_id, code, discount_type, discount_value, status, usage_limit,
      included_product_ids, excluded_product_ids, included_category_ids, excluded_category_ids, maximum_discount
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
      id, STORE, overrides.code || code, overrides.type || 'percentage', overrides.value || '10.00', 'active',
      overrides.usageLimit || null, JSON.stringify(overrides.incP || []), JSON.stringify(overrides.excP || []),
      JSON.stringify(overrides.incC || []), JSON.stringify(overrides.excC || []), overrides.maxDiscount || null
    ]);
    return { id, code: overrides.code || code };
  }

  before(async () => {
    const { TestConfig, bootstrapTestApp } = require('./commercial-closure.pg.cjs');
    app = await bootstrapTestApp({ ...TestConfig, imports: [] });
    pool = app.get('DATABASE_POOL');
    orders = app.get(require('../dist/orders/orders.service').OrdersService);
    
    await query(`DELETE FROM coupons WHERE store_id=$1`, [STORE]);
    await query(`DELETE FROM products WHERE store_id=$1`, [STORE]);
  });

  after(async () => {
    if (app) await app.close();
  });

  test('Manual Order بكوبون عام', async () => {
    const item1 = await catalog('general1', 10, 100);
    const item2 = await catalog('general2', 10, 200);
    const coupon = await createCoupon({ value: '10.00', type: 'percentage' }); // 10% off

    const customerId = randomUUID();
    await query(`INSERT INTO customers (id, store_id, full_name, phone) VALUES ($1,$2,$3,$4)`,
      [customerId, STORE, 'Gen Cust', '+1000000000']);

    const res = await orders.createManual(authUser, {
      customerId,
      lines: [
        { variantId: item1.variantId, quantity: 2 }, // 200
        { variantId: item2.variantId, quantity: 1 }  // 200
      ], // Subtotal = 400. 10% = 40.
      paymentMethod: 'bank_transfer',
      couponCode: coupon.code,
      shippingZoneId: ZONE,
      shippingMethodId: METHOD,
      currencyCode: 'YER'
    }, randomUUID(), context);

    assert.equal(res.totals.discountAmount, '40.00');
    
    // Check coupon usage ledger
    const usages = await query(`SELECT count(*) FROM coupon_usages WHERE store_id=$1 AND order_id=$2`, [STORE, res.id]);
    assert.equal(usages.rows[0].count, '1');
  });

  test('كوبون مخصص لمنتج واحد', async () => {
    const item1 = await catalog('spec1', 10, 100);
    const item2 = await catalog('spec2', 10, 200);
    const coupon = await createCoupon({ value: '20.00', type: 'percentage', incP: [item1.productId] }); // 20% off item1 only

    const customerId = randomUUID();
    await query(`INSERT INTO customers (id, store_id, full_name, phone) VALUES ($1,$2,$3,$4)`,
      [customerId, STORE, 'Spec Cust', '+1000000001']);

    const res = await orders.createManual(authUser, {
      customerId,
      lines: [
        { variantId: item1.variantId, quantity: 2 }, // 200 -> 40 discount
        { variantId: item2.variantId, quantity: 1 }  // 200 -> 0 discount
      ],
      paymentMethod: 'bank_transfer',
      couponCode: coupon.code,
      shippingZoneId: ZONE,
      shippingMethodId: METHOD,
      currencyCode: 'YER'
    }, randomUUID(), context);

    assert.equal(res.totals.discountAmount, '40.00'); // only item1 is discounted
  });

  test('كوبون مخصص لتصنيف واحد', async () => {
    const item1 = await catalog('cat1', 10, 100);
    const item2 = await catalog('cat2', 10, 200);
    const coupon = await createCoupon({ value: '15.00', type: 'fixed', incC: [item1.categoryId] }); // 15 off item1's category

    const customerId = randomUUID();
    await query(`INSERT INTO customers (id, store_id, full_name, phone) VALUES ($1,$2,$3,$4)`,
      [customerId, STORE, 'Cat Cust', '+1000000002']);

    const res = await orders.createManual(authUser, {
      customerId,
      lines: [
        { variantId: item1.variantId, quantity: 2 }, // 200 -> 15 discount
        { variantId: item2.variantId, quantity: 1 }  // 200 -> 0 discount
      ],
      paymentMethod: 'bank_transfer',
      couponCode: coupon.code,
      shippingZoneId: ZONE,
      shippingMethodId: METHOD,
      currencyCode: 'YER'
    }, randomUUID(), context);

    assert.equal(res.totals.discountAmount, '15.00');
  });
  
  test('max discount', async () => {
    const item = await catalog('max1', 10, 1000);
    const coupon = await createCoupon({ value: '50.00', type: 'percentage', maxDiscount: '100.00' });

    const customerId = randomUUID();
    await query(`INSERT INTO customers (id, store_id, full_name, phone) VALUES ($1,$2,$3,$4)`,
      [customerId, STORE, 'Max Cust', '+1000000003']);

    const res = await orders.createManual(authUser, {
      customerId,
      lines: [
        { variantId: item.variantId, quantity: 2 }, // 2000. 50% = 1000. Capped at 100.
      ],
      paymentMethod: 'bank_transfer',
      couponCode: coupon.code,
      shippingZoneId: ZONE,
      shippingMethodId: METHOD,
      currencyCode: 'YER'
    }, randomUUID(), context);

    assert.equal(res.totals.discountAmount, '100.00');
  });

  test('فشل إنشاء الطلب بعد احتساب الكوبون -> لا Usage ولا Counter mutation', async () => {
    const item = await catalog('fail1', 10, 100);
    const coupon = await createCoupon({ value: '10.00', type: 'percentage' });

    const customerId = randomUUID();
    await query(`INSERT INTO customers (id, store_id, full_name, phone) VALUES ($1,$2,$3,$4)`,
      [customerId, STORE, 'Fail Cust', '+1000000004']);

    let failed = false;
    try {
      await orders.createManual(authUser, {
        customerId,
        lines: [
          { variantId: item.variantId, quantity: 200 } // out of stock, will fail in inventory service
        ],
        paymentMethod: 'bank_transfer',
        couponCode: coupon.code,
        shippingZoneId: ZONE,
        shippingMethodId: METHOD,
        currencyCode: 'YER'
      }, randomUUID(), context);
    } catch (e) {
      failed = true;
    }
    
    assert.equal(failed, true, 'Order creation should fail');

    // Check coupon usages
    const usages = await query(`SELECT count(*) FROM coupon_usages WHERE store_id=$1 AND coupon_id=$2`, [STORE, coupon.id]);
    assert.equal(usages.rows[0].count, '0');
    
    const cData = await query(`SELECT usage_count FROM coupons WHERE id=$1`, [coupon.id]);
    assert.equal(cData.rows[0].usage_count, 0);
  });
});
