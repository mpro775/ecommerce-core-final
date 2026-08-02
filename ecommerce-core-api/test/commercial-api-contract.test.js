const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const document = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'api', 'openapi.json'), 'utf8'));
const schemas = document.components.schemas;

function schema(name) {
  const value = schemas[name];
  assert.ok(value, `missing OpenAPI schema ${name}`);
  if (!value.allOf) return value;
  return value.allOf.reduce((merged, part) => {
    const resolved = part.$ref ? schema(part.$ref.split('/').at(-1)) : part;
    return { ...merged, ...resolved, properties: { ...(merged.properties ?? {}), ...(resolved.properties ?? {}) },
      required: [...new Set([...(merged.required ?? []), ...(resolved.required ?? [])])] };
  }, {});
}

describe('commercial API contract lock', () => {
  it('publishes all explicit command routes and no generic status mutation route', () => {
    const expected = [
      '/orders/{orderId}/confirm','/orders/{orderId}/cancel','/orders/{orderId}/complete',
      '/orders/{orderId}/fulfillment/start-preparing',
      '/orders/{orderId}/fulfillment/start-preparing-with-payment-override',
      '/orders/{orderId}/fulfillment/mark-ready','/orders/{orderId}/fulfillment/dispatch',
      '/orders/{orderId}/fulfillment/mark-fulfilled','/orders/{orderId}/fulfillment/mark-failed',
      '/orders/{orderId}/fulfillment/retry','/orders/{orderId}/fulfillment/cancel',
      '/payments/{paymentId}/submit-proof','/payments/{paymentId}/resubmit-proof',
      '/payments/{paymentId}/start-review','/payments/{paymentId}/approve',
      '/payments/{paymentId}/reject','/payments/{paymentId}/collect-cod',
      '/payments/{paymentId}/expire','/payments/{paymentId}/cancel',
    ];
    for (const route of expected) assert.ok(document.paths[route]?.post, `missing POST ${route}`);
    assert.equal(Object.keys(document.paths).some((route) => /\/(orders|payments)\/\{[^}]+\}\/status$/u.test(route)), false);
  });

  it('locks identifiers, money strings, enums, transitions, dates, and detail evidence', () => {
    const detail = schema('OrderDetailDto');
    for (const field of ['id','orderNumber','status','fulfillment','payment','totals','items',
      'allowedTransitions','fulfillmentHistory','paymentHistory','inventoryReservations',
      'auditTimeline','createdAt','updatedAt']) assert.ok(detail.properties[field], field);
    assert.equal(detail.properties.createdAt.format, 'date-time');
    assert.deepEqual(schema('OrderSummaryDto').properties.status.enum, ['new','confirmed','completed','cancelled']);
    assert.deepEqual(schema('PaymentDto').properties.status.enum,
      ['pending','submitted','under_review','approved','rejected','expired','cancelled','partially_refunded','refunded']);
    for (const field of ['subtotalAmount','discountAmount','shippingAmount','taxAmount','totalAmount',
      'paidAmount','refundedAmount','refundableAmount','currency']) {
      assert.equal(schema('MoneyTotalsDto').properties[field].type, 'string', field);
    }
    for (const field of ['amount','paidAmount','refundedAmount','refundableAmount','currency']) {
      assert.equal(schema('PaymentDto').properties[field].type, 'string', field);
    }
    assert.equal(JSON.stringify({ OrderDetailDto: detail, PaymentDto: schema('PaymentDto') }).includes('"_id"'), false);
  });

  it('uses data/meta pagination and documents the standard commercial error envelope', () => {
    for (const name of ['PaginatedOrdersDto','PaginatedPaymentsDto']) {
      const paginated = schema(name);
      assert.ok(paginated.properties.data);
      assert.ok(paginated.properties.meta);
      assert.equal('items' in paginated.properties, false);
    }
    const error = schema('CommercialErrorResponseDto');
    for (const field of ['statusCode','message','path','timestamp','requestId']) assert.ok(error.properties[field]);
    assert.equal(error.properties.timestamp.format, 'date-time');
    assert.ok(document.paths['/orders/{orderId}/confirm'].post.responses['409']);
    assert.ok(document.paths['/payments/{paymentId}/approve'].post.responses['403']);
  });
});
