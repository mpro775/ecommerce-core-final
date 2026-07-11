require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { ShippingCalculatorService } = require('../dist/shipping/shipping-calculator.service');

function createZone(overrides = {}) {
  return {
    id: 'zone-1',
    store_id: 'store-1',
    name: 'Zone 1',
    city: null,
    area: null,
    description: null,
    fee: '15.00',
    is_active: true,
    ...overrides,
  };
}

function createMethod(type, config = {}, overrides = {}) {
  return {
    id: `method-${type}`,
    store_id: 'store-1',
    shipping_zone_id: 'zone-1',
    method_type: type,
    display_name: type,
    description: null,
    is_active: true,
    sort_order: 0,
    min_delivery_days: 1,
    max_delivery_days: 3,
    config,
    ranges: [],
    ...overrides,
  };
}

describe('Sprint 12 shipping calculator', () => {
  it('allows zero flat rate cost', () => {
    const service = new ShippingCalculatorService();
    const result = service.resolveMethod({
      zone: createZone(),
      methods: [createMethod('flat_rate', { cost: 0 })],
      items: [{ quantity: 2, productWeight: 1 }],
      subtotal: 200,
      couponCode: null,
      couponIsFreeShipping: false,
      autoSelectStrategy: 'free_then_first',
    });

    assert.equal(result.selectedMethod?.cost, 0);
  });

  it('applies by_weight formula and respects min/max caps', () => {
    const service = new ShippingCalculatorService();
    const result = service.resolveMethod({
      zone: createZone(),
      methods: [
        createMethod('by_weight', {
          baseCost: 0,
          costPerKg: 2,
          minCost: 5,
          maxCost: 8,
        }),
      ],
      items: [{ quantity: 1, productWeight: 10 }],
      subtotal: 300,
      couponCode: null,
      couponIsFreeShipping: false,
      autoSelectStrategy: 'free_then_first',
    });

    assert.equal(result.selectedMethod?.cost, 8);
  });

  it('uses tier ranges with min inclusive and max exclusive and supports open max', () => {
    const service = new ShippingCalculatorService();
    const result = service.resolveMethod({
      zone: createZone(),
      methods: [
        createMethod(
          'weight_tier',
          {},
          {
            ranges: [
              {
                id: 'r1',
                shipping_method_id: 'm1',
                range_min: '0',
                range_max: '2',
                cost: '3',
                sort_order: 0,
              },
              {
                id: 'r2',
                shipping_method_id: 'm1',
                range_min: '2',
                range_max: null,
                cost: '7',
                sort_order: 1,
              },
            ],
          },
        ),
      ],
      items: [{ quantity: 1, productWeight: 2 }],
      subtotal: 100,
      couponCode: null,
      couponIsFreeShipping: false,
      autoSelectStrategy: 'free_then_first',
    });

    assert.equal(result.selectedMethod?.cost, 7);
  });

  it('enables free shipping by coupon only when coupon has free-shipping flag', () => {
    const service = new ShippingCalculatorService();
    const methods = [
      createMethod('free_shipping', { conditionType: 'coupon' }, { sort_order: 0 }),
      createMethod('flat_rate', { cost: 10 }, { sort_order: 1 }),
    ];

    const withoutFlag = service.resolveMethod({
      zone: createZone(),
      methods,
      items: [{ quantity: 1, productWeight: 1 }],
      subtotal: 80,
      couponCode: 'SAVE10',
      couponIsFreeShipping: false,
      autoSelectStrategy: 'free_then_first',
    });
    assert.equal(withoutFlag.selectedMethod?.type, 'flat_rate');
    assert.equal(withoutFlag.selectedMethod?.cost, 10);

    const withFlag = service.resolveMethod({
      zone: createZone(),
      methods,
      items: [{ quantity: 1, productWeight: 1 }],
      subtotal: 80,
      couponCode: 'FREESHIP',
      couponIsFreeShipping: true,
      autoSelectStrategy: 'free_then_first',
    });
    assert.equal(withFlag.selectedMethod?.type, 'free_shipping');
    assert.equal(withFlag.selectedMethod?.cost, 0);
  });

  it('does not synthesize a legacy method when no methods are configured', () => {
    const service = new ShippingCalculatorService();
    const result = service.resolveMethod({
      zone: createZone({ fee: '12.50' }),
      methods: [],
      items: [{ quantity: 1, productWeight: null }],
      subtotal: 30,
      couponCode: null,
      couponIsFreeShipping: false,
      autoSelectStrategy: 'free_then_first',
    });

    assert.equal(result.selectedMethod, null);
    assert.equal(result.availableMethods.length, 0);
  });
});
