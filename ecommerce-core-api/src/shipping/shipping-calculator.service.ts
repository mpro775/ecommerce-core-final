import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ShippingMethodRangeRecord,
  ShippingMethodRecord,
  ShippingZoneRecord,
} from './shipping.repository';

export interface ShippingCalculationItemInput {
  quantity: number;
  productWeight: number | null;
}

export interface ShippingMethodQuote {
  id: string;
  zoneId: string;
  type: string;
  displayName: string;
  description: string | null;
  cost: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  isActive: boolean;
  sortOrder: number;
}

export interface ResolveShippingMethodInput {
  zone: ShippingZoneRecord;
  methods: Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>;
  items: ShippingCalculationItemInput[];
  subtotal: number;
  couponCode: string | null;
  couponIsFreeShipping: boolean;
  requestedMethodId?: string | null;
  autoSelectStrategy?: 'none' | 'free_then_first';
}

export interface ResolveShippingMethodResult {
  availableMethods: ShippingMethodQuote[];
  selectedMethod: ShippingMethodQuote | null;
}

@Injectable()
export class ShippingCalculatorService {
  resolveMethod(input: ResolveShippingMethodInput): ResolveShippingMethodResult {
    const weightKg = this.computeOrderWeightKg(input.items);
    const itemCount = this.computeItemCount(input.items);

    const availableMethods = this.resolveAvailableMethods({
      ...input,
      weightKg,
      itemCount,
    });

    if (availableMethods.length === 0) {
      return {
        availableMethods: [],
        selectedMethod: null,
      };
    }

    if (input.requestedMethodId) {
      const selected = availableMethods.find((method) => method.id === input.requestedMethodId);
      if (!selected) {
        throw new BadRequestException('Shipping method not found or not applicable');
      }
      return { availableMethods, selectedMethod: selected };
    }

    if (input.autoSelectStrategy === 'none') {
      return { availableMethods, selectedMethod: null };
    }

    const selected =
      availableMethods.find((method) => method.type === 'free_shipping') ??
      availableMethods[0] ??
      null;

    return {
      availableMethods,
      selectedMethod: selected,
    };
  }

  private resolveAvailableMethods(input: {
    zone: ShippingZoneRecord;
    methods: Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>;
    weightKg: number;
    itemCount: number;
    subtotal: number;
    couponCode: string | null;
    couponIsFreeShipping: boolean;
  }): ShippingMethodQuote[] {
    const methodsToEvaluate = input.methods.filter((method) => method.is_active);

    const resolved: ShippingMethodQuote[] = [];
    for (const method of methodsToEvaluate) {
      const cost = this.computeMethodCost({
        method,
        weightKg: input.weightKg,
        itemCount: input.itemCount,
        subtotal: input.subtotal,
        couponCode: input.couponCode,
        couponIsFreeShipping: input.couponIsFreeShipping,
      });

      if (cost === null) {
        continue;
      }

      resolved.push({
        id: method.id,
        zoneId: method.shipping_zone_id,
        type: method.method_type,
        displayName: method.display_name,
        description: method.description,
        cost,
        minDeliveryDays: method.min_delivery_days,
        maxDeliveryDays: method.max_delivery_days,
        isActive: method.is_active,
        sortOrder: method.sort_order,
      });
    }

    return resolved.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private computeMethodCost(input: {
    method: ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] };
    weightKg: number;
    itemCount: number;
    subtotal: number;
    couponCode: string | null;
    couponIsFreeShipping: boolean;
  }): number | null {
    const config = input.method.config ?? {};

    switch (input.method.method_type) {
      case 'flat_rate':
        return this.asMoney(config.cost);

      case 'by_weight': {
        const baseCost = this.asMoney(config.baseCost);
        const costPerKg = this.asMoney(config.costPerKg);
        let result = baseCost + costPerKg * input.weightKg;
        const minCost = this.asOptionalMoney(config.minCost);
        const maxCost = this.asOptionalMoney(config.maxCost);
        if (minCost !== null) {
          result = Math.max(result, minCost);
        }
        if (maxCost !== null) {
          result = Math.min(result, maxCost);
        }
        return this.roundMoney(result);
      }

      case 'by_item': {
        const baseCost = this.asMoney(config.baseCost);
        const costPerItem = this.asMoney(config.costPerItem);
        let result = baseCost + costPerItem * input.itemCount;
        const minCost = this.asOptionalMoney(config.minCost);
        const maxCost = this.asOptionalMoney(config.maxCost);
        if (minCost !== null) {
          result = Math.max(result, minCost);
        }
        if (maxCost !== null) {
          result = Math.min(result, maxCost);
        }
        return this.roundMoney(result);
      }

      case 'weight_tier':
        return this.resolveTierCost(input.method.ranges, input.weightKg);

      case 'order_value_tier':
        return this.resolveTierCost(input.method.ranges, input.subtotal);

      case 'free_shipping': {
        const conditionType = String(config.conditionType ?? 'none');
        if (conditionType === 'none') {
          return 0;
        }
        if (conditionType === 'coupon') {
          if (input.couponCode && input.couponIsFreeShipping) {
            return 0;
          }
          return null;
        }
        if (conditionType === 'min_order_amount') {
          const minOrderAmount = this.asMoney(config.minOrderAmount);
          return input.subtotal >= minOrderAmount ? 0 : null;
        }
        return null;
      }

      case 'store_pickup':
        return this.asMoney(config.pickupCost);

      default:
        return null;
    }
  }

  private resolveTierCost(ranges: ShippingMethodRangeRecord[], value: number): number | null {
    for (const range of ranges) {
      const min = Number(range.range_min);
      const max = range.range_max === null ? null : Number(range.range_max);
      const matches = value >= min && (max === null || value < max);
      if (matches) {
        return this.roundMoney(Number(range.cost));
      }
    }

    return null;
  }

  private computeOrderWeightKg(items: ShippingCalculationItemInput[]): number {
    return this.round3(
      items.reduce((sum, item) => {
        const weight = item.productWeight ?? 0;
        return sum + Math.max(weight, 0) * item.quantity;
      }, 0),
    );
  }

  private computeItemCount(items: ShippingCalculationItemInput[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }

  private asMoney(value: unknown): number {
    return this.roundMoney(Math.max(Number(value ?? 0), 0));
  }

  private asOptionalMoney(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return this.roundMoney(Math.max(numeric, 0));
  }

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private round3(value: number): number {
    return Number(value.toFixed(3));
  }
}
