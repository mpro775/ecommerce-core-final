const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { canTransitionOrderStatus } = require('../dist/orders/constants/order-status.constants');
const {
  FULFILLMENT_RULES,
  getFulfillmentRule,
} = require('../dist/orders/transitions/fulfillment-transition.rules');
const { PAYMENT_COMMAND_RULES } = require('../dist/payments/payment-transition.rules');

describe('locked commercial state-machine matrices', () => {
  it('allows every and only canonical order transition', () => {
    const states = ['new', 'confirmed', 'completed', 'cancelled'];
    const allowed = new Set(['new:confirmed', 'new:cancelled', 'confirmed:completed', 'confirmed:cancelled']);
    for (const from of states) for (const to of states) {
      assert.equal(canTransitionOrderStatus(from, to), allowed.has(`${from}:${to}`), `${from} -> ${to}`);
    }
  });

  it('keys every fulfillment decision by command, type, and current status', () => {
    const types = ['delivery', 'pickup', 'external_shipping', 'manual_coordination'];
    const statuses = ['unfulfilled', 'preparing', 'ready', 'out_for_delivery', 'fulfilled', 'failed', 'cancelled'];
    for (const [command, rule] of Object.entries(FULFILLMENT_RULES)) {
      for (const type of types) for (const status of statuses) {
        let expected = rule.types.includes(type) && rule.from.includes(status);
        if (command === 'markFulfilled') {
          expected &&= type === 'delivery' ? status === 'out_for_delivery' : status === 'ready';
        }
        if (expected) {
          assert.equal(getFulfillmentRule(command, type, status).to, rule.to);
        } else {
          assert.throws(() => getFulfillmentRule(command, type, status), /FULFILLMENT_TRANSITION_NOT_ALLOWED/u);
        }
      }
    }
  });

  it('locks proof, review, COD, expiry, cancellation, and prohibited payment sources', () => {
    assert.deepEqual(PAYMENT_COMMAND_RULES.submitPaymentProof.from, ['pending']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.resubmitPaymentProof.from, ['rejected']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.startPaymentReview.from, ['submitted']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.approvePayment.from, ['under_review']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.rejectPayment.from, ['under_review']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.collectCodPayment.from, ['pending']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.expirePayment.from, ['pending', 'submitted']);
    assert.deepEqual(PAYMENT_COMMAND_RULES.cancelPayment.from, ['pending', 'submitted', 'under_review']);
    for (const status of ['rejected', 'expired', 'cancelled', 'approved', 'partially_refunded', 'refunded']) {
      assert.equal(PAYMENT_COMMAND_RULES.approvePayment.from.includes(status), false);
    }
    assert.equal(Object.values(PAYMENT_COMMAND_RULES).some((rule) => rule.to.includes('refunded')), false);
  });
});
