require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { LoyaltyService } = require('../dist/loyalty/loyalty.service');

function createService() {
  return new LoyaltyService({}, { async log() {} }, { async dispatchEvent() {} });
}

describe('Sprint 11 loyalty core calculations', () => {
  it('returns zero redemption when request is empty', () => {
    const service = createService();
    const estimate = service.computeRedeemEstimate({
      program: {
        min_redeem_points: 100,
        redeem_step_points: 100,
        redeem_rate_points: 100,
        redeem_rate_amount: 1,
        max_discount_percent: 100,
      },
      availablePoints: 1000,
      requestedPoints: 0,
      totalBeforeDiscount: 500,
    });

    assert.deepEqual(estimate, { pointsRedeemed: 0, discountAmount: 0 });
  });

  it('enforces minimum points threshold', () => {
    const service = createService();

    assert.throws(
      () =>
        service.computeRedeemEstimate({
          program: {
            min_redeem_points: 100,
            redeem_step_points: 100,
            redeem_rate_points: 100,
            redeem_rate_amount: 1,
            max_discount_percent: 100,
          },
          availablePoints: 5000,
          requestedPoints: 50,
          totalBeforeDiscount: 200,
        }),
      /Minimum redeem points is 100/,
    );
  });

  it('caps discount by max discount percent and normalizes used points', () => {
    const service = createService();
    const estimate = service.computeRedeemEstimate({
      program: {
        min_redeem_points: 100,
        redeem_step_points: 100,
        redeem_rate_points: 100,
        redeem_rate_amount: 1,
        max_discount_percent: 30,
      },
      availablePoints: 50000,
      requestedPoints: 50000,
      totalBeforeDiscount: 200,
    });

    assert.equal(estimate.discountAmount, 60);
    assert.equal(estimate.pointsRedeemed, 6000);
  });

  it('rounds requested points down to step size', () => {
    const service = createService();
    const estimate = service.computeRedeemEstimate({
      program: {
        min_redeem_points: 100,
        redeem_step_points: 100,
        redeem_rate_points: 100,
        redeem_rate_amount: 1,
        max_discount_percent: 100,
      },
      availablePoints: 2000,
      requestedPoints: 155,
      totalBeforeDiscount: 1000,
    });

    assert.equal(estimate.pointsRedeemed, 100);
    assert.equal(estimate.discountAmount, 1);
  });
});
