require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AffiliatesService } = require('../dist/affiliates/affiliates.service');

describe('Sprint 11 affiliates core logic', () => {
  it('prioritizes coupon attribution over last-click attribution', async () => {
    const repo = {
      async getStoreSettings() {
        return {
          affiliate_enabled: true,
          affiliate_default_rate: '10',
          affiliate_attribution_window_days: 30,
          affiliate_min_payout: '5000',
        };
      },
      async resolveCouponAttribution() {
        return {
          affiliate_id: 'coupon-affiliate',
          affiliate_link_id: null,
          source: 'coupon',
        };
      },
      async resolveLastClickAttribution() {
        return {
          affiliate_id: 'click-affiliate',
          affiliate_link_id: 'link-1',
          source: 'link',
        };
      },
    };

    const service = new AffiliatesService(repo, { async log() {} });
    const result = await service.resolveCheckoutAttribution({
      storeId: 'store-1',
      sessionId: 'session-1',
      couponCode: 'AFF10',
    });

    assert.equal(result.affiliateId, 'coupon-affiliate');
    assert.equal(result.attributionType, 'coupon');
  });

  it('calculates commission as subtotal minus discount total', () => {
    const service = new AffiliatesService({}, { async log() {} });
    const result = service.computeCommissionAmount({
      subtotal: 1000,
      discountTotal: 120,
      ratePercent: 10,
    });

    assert.equal(result.commissionBase, 880);
    assert.equal(result.commissionAmount, 88);
  });

  it('floors commission base at zero', () => {
    const service = new AffiliatesService({}, { async log() {} });
    const result = service.computeCommissionAmount({
      subtotal: 100,
      discountTotal: 150,
      ratePercent: 10,
    });

    assert.equal(result.commissionBase, 0);
    assert.equal(result.commissionAmount, 0);
  });
});
