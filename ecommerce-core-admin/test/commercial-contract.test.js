const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const orders = read('src/features/merchant/panels/orders/orders-panel.tsx');
const payments = read('src/features/merchant/panels/payments/payments-panel.tsx');
const format = read('src/lib/commercial-format.ts');
const generated = read('src/api/generated/openapi.ts');

describe('Admin commercial coordinated cutover', () => {
  it('renders only backend-provided allowed transitions and invokes explicit command routes', () => {
    assert.match(orders, /selectedOrder\.allowedTransitions\.order\.map/u);
    assert.match(orders, /selectedOrder\.allowedTransitions\.fulfillment\.map/u);
    assert.match(orders, /selectedOrder\.allowedTransitions\.payment\.map/u);
    assert.match(payments, /payment\.allowedTransitions\.map/u);
    for (const route of ['start-review','approve','reject','collect-cod','expire','cancel']) {
      assert.match(payments, new RegExp(`['"]${route}['"]`, 'u'));
    }
    assert.doesNotMatch(orders, /updateOrderStatus|statusOptions|ORDER_STATUS_OPTIONS/u);
    assert.doesNotMatch(payments, /updatePaymentStatus|statusOptions|PAYMENT_STATUS_OPTIONS/u);
  });

  it('uses the shared Asia/Aden formatter and API financial truth', () => {
    assert.match(format, /timeZone:\s*['"]Asia\/Aden['"]/u);
    assert.doesNotMatch(`${orders}\n${payments}`, /\.toLocale(String|DateString|TimeString)\s*\(/u);
    for (const field of ['subtotalAmount','discountAmount','shippingAmount','taxAmount','totalAmount',
      'paidAmount','refundedAmount','refundableAmount']) assert.match(orders, new RegExp(`totals\\.${field}`, 'u'));
    assert.match(payments, /payment\.amount/u);
    assert.doesNotMatch(payments, /payment\.paidAmount\s*-\s*payment\.refundedAmount/u);
  });

  it('compiles against generated commercial schemas without compatibility fallbacks', () => {
    for (const field of ['allowedTransitions','fulfillmentHistory','paymentHistory',
      'inventoryReservations','auditTimeline']) assert.match(generated, new RegExp(`${field}:`, 'u'));
    assert.doesNotMatch(`${orders}\n${payments}`, /response\.items\s*\?\?|\.total\s*\?\?\s*.*meta\.total|\b_id\b/u);
  });
});
