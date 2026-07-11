import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import {
  FREE_SHIPPING_CONDITION_TYPES,
  type FreeShippingConditionType,
  type ShippingMethodType,
} from './constants/shipping-method.constants';
import type { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import type { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import type { ListShippingZonesQueryDto } from './dto/list-shipping-zones-query.dto';
import type { QuickFulfillmentSetupDto } from './dto/quick-fulfillment-setup.dto';
import type { UpdateShippingMethodDto } from './dto/update-shipping-method.dto';
import type { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';
import {
  ShippingRepository,
  type ShippingMethodRangeRecord,
  type ShippingMethodRecord,
  type ShippingZoneRecord,
} from './shipping.repository';

interface NormalizedRangeInput {
  min: number;
  max: number | null;
  cost: number;
  sortOrder: number;
}

interface NormalizedMethodPayload {
  type: ShippingMethodType;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  config: Record<string, unknown>;
  ranges: NormalizedRangeInput[];
}

export interface ShippingMethodResponse {
  id: string;
  storeId: string;
  shippingZoneId: string;
  type: ShippingMethodType;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  config: Record<string, unknown>;
  ranges: Array<{ min: number; max: number | null; cost: number; sortOrder: number }>;
}

export interface ShippingZoneResponse {
  id: string;
  storeId: string;
  name: string;
  city: string | null;
  area: string | null;
  description: string | null;
  fee: number;
  isActive: boolean;
}

export interface FulfillmentSettingsResponse {
  isReady: boolean;
  zones: ShippingZoneResponse[];
  activeMethodsCount: number;
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly shippingRepository: ShippingRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateShippingZoneDto,
    context: RequestContextData,
  ): Promise<ShippingZoneResponse> {
    const zone = await this.shippingRepository.create({
      storeId: currentUser.storeId,
      name: input.name.trim(),
      city: input.city?.trim() ?? null,
      area: input.area?.trim() ?? null,
      description: input.description?.trim() ?? null,
      fee: input.fee ?? 0,
      isActive: input.isActive ?? true,
    });

    await this.log('shipping.zone_created', currentUser, zone.id, context, 'shipping_zone');
    return this.toResponse(zone);
  }

  async list(
    currentUser: AuthUser,
    query: ListShippingZonesQueryDto,
  ): Promise<ShippingZoneResponse[]> {
    const rows = await this.shippingRepository.list(currentUser.storeId, query.q?.trim());
    return rows.map((row) => this.toResponse(row));
  }

  async getFulfillmentSettings(currentUser: AuthUser): Promise<FulfillmentSettingsResponse> {
    const zones = await this.shippingRepository.list(currentUser.storeId);
    const activeMethods = await this.shippingRepository.listActiveMethodsAcrossZones(
      currentUser.storeId,
    );
    return {
      isReady: activeMethods.length > 0,
      zones: zones.map((row) => this.toResponse(row)),
      activeMethodsCount: activeMethods.length,
    };
  }

  async quickSetup(
    currentUser: AuthUser,
    input: QuickFulfillmentSetupDto,
    context: RequestContextData,
  ): Promise<FulfillmentSettingsResponse> {
    const city = input.city.trim();
    if (!city) {
      throw new BadRequestException('city is required');
    }

    const zone = await this.shippingRepository.create({
      storeId: currentUser.storeId,
      name: `داخل ${city}`,
      city,
      area: null,
      description: null,
      fee: input.localDeliveryFee ?? 0,
      isActive: Boolean(input.enableLocalDelivery || input.enablePickup),
    });

    if (input.enableLocalDelivery) {
      await this.createMethod(
        currentUser,
        zone.id,
        {
          type: 'flat_rate',
          displayName: `توصيل داخل ${city}`,
          description: undefined,
          isActive: true,
          sortOrder: 0,
          minDeliveryDays: 0,
          maxDeliveryDays: 1,
          cost: input.localDeliveryFee ?? 0,
        },
        context,
      );
    }

    if (input.enablePickup) {
      await this.createMethod(
        currentUser,
        zone.id,
        {
          type: 'store_pickup',
          displayName: 'استلام من المتجر',
          description: input.pickupAddress?.trim() || undefined,
          isActive: true,
          sortOrder: 1,
          minDeliveryDays: 0,
          maxDeliveryDays: 0,
          pickupCost: 0,
        },
        context,
      );
    }

    await this.log(
      'fulfillment.quick_setup_completed',
      currentUser,
      zone.id,
      context,
      'shipping_zone',
    );
    return this.getFulfillmentSettings(currentUser);
  }

  async update(
    currentUser: AuthUser,
    zoneId: string,
    input: UpdateShippingZoneDto,
    context: RequestContextData,
  ): Promise<ShippingZoneResponse> {
    const existing = await this.shippingRepository.findById(currentUser.storeId, zoneId);
    if (!existing) {
      throw new NotFoundException('Shipping zone not found');
    }

    const updated = await this.shippingRepository.update(
      this.buildUpdatePayload(currentUser.storeId, zoneId, input, existing),
    );

    if (!updated) {
      throw new NotFoundException('Shipping zone not found');
    }

    await this.log('shipping.zone_updated', currentUser, zoneId, context, 'shipping_zone');
    return this.toResponse(updated);
  }

  async remove(currentUser: AuthUser, zoneId: string, context: RequestContextData): Promise<void> {
    const deleted = await this.shippingRepository.delete(currentUser.storeId, zoneId);
    if (!deleted) {
      throw new NotFoundException('Shipping zone not found');
    }
    await this.log('shipping.zone_deleted', currentUser, zoneId, context, 'shipping_zone');
  }

  async listMethods(currentUser: AuthUser, zoneId: string): Promise<ShippingMethodResponse[]> {
    await this.requireZone(currentUser.storeId, zoneId);
    const rows = await this.shippingRepository.listMethodsByZone(currentUser.storeId, zoneId);
    return rows.map((row) => this.mapMethod(row));
  }

  async createMethod(
    currentUser: AuthUser,
    zoneId: string,
    input: CreateShippingMethodDto,
    context: RequestContextData,
  ): Promise<ShippingMethodResponse> {
    await this.requireZone(currentUser.storeId, zoneId);

    const payload = this.normalizeMethodPayload(input);
    const created = await this.shippingRepository.withTransaction((db) =>
      this.shippingRepository.createMethod(db, {
        storeId: currentUser.storeId,
        zoneId,
        methodType: payload.type,
        displayName: payload.displayName,
        description: payload.description,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        minDeliveryDays: payload.minDeliveryDays,
        maxDeliveryDays: payload.maxDeliveryDays,
        config: payload.config,
        ranges: payload.ranges,
      }),
    );

    await this.log('shipping.method_created', currentUser, created.id, context, 'shipping_method');
    return this.mapMethod(created);
  }

  async updateMethod(
    currentUser: AuthUser,
    zoneId: string,
    methodId: string,
    input: UpdateShippingMethodDto,
    context: RequestContextData,
  ): Promise<ShippingMethodResponse> {
    const existing = await this.shippingRepository.findMethodById(
      currentUser.storeId,
      zoneId,
      methodId,
    );
    if (!existing) {
      throw new NotFoundException('Shipping method not found');
    }

    const payload = this.normalizeMethodPayload(
      {
        ...input,
        type: input.type ?? existing.method_type,
        displayName: input.displayName ?? existing.display_name,
      } as CreateShippingMethodDto,
      existing,
    );

    const updated = await this.shippingRepository.withTransaction((db) =>
      this.shippingRepository.updateMethod(db, {
        storeId: currentUser.storeId,
        zoneId,
        methodId,
        methodType: payload.type,
        displayName: payload.displayName,
        description: payload.description,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder,
        minDeliveryDays: payload.minDeliveryDays,
        maxDeliveryDays: payload.maxDeliveryDays,
        config: payload.config,
        ranges: payload.ranges,
      }),
    );

    if (!updated) {
      throw new NotFoundException('Shipping method not found');
    }

    await this.log('shipping.method_updated', currentUser, methodId, context, 'shipping_method');
    return this.mapMethod(updated);
  }

  async removeMethod(
    currentUser: AuthUser,
    zoneId: string,
    methodId: string,
    context: RequestContextData,
  ): Promise<void> {
    const deleted = await this.shippingRepository.deleteMethod(
      currentUser.storeId,
      zoneId,
      methodId,
    );
    if (!deleted) {
      throw new NotFoundException('Shipping method not found');
    }

    await this.log('shipping.method_deleted', currentUser, methodId, context, 'shipping_method');
  }

  private normalizeMethodPayload(
    input: CreateShippingMethodDto,
    existing?: ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] },
  ): NormalizedMethodPayload {
    const type = input.type ?? existing?.method_type;
    if (!type) {
      throw new BadRequestException('Shipping method type is required');
    }

    const displayName = input.displayName?.trim();
    if (!displayName) {
      throw new BadRequestException('displayName is required');
    }

    const baseConfig = existing?.config ?? {};
    const rawMinDeliveryDays = input.minDeliveryDays ?? existing?.min_delivery_days ?? 0;
    const rawMaxDeliveryDays =
      input.maxDeliveryDays ?? existing?.max_delivery_days ?? rawMinDeliveryDays;
    if (rawMaxDeliveryDays < rawMinDeliveryDays) {
      throw new BadRequestException(
        'maxDeliveryDays must be greater than or equal to minDeliveryDays',
      );
    }

    const payload: NormalizedMethodPayload = {
      type,
      displayName,
      description: input.description?.trim() ?? existing?.description ?? null,
      isActive: input.isActive ?? existing?.is_active ?? true,
      sortOrder: input.sortOrder ?? existing?.sort_order ?? 0,
      minDeliveryDays: rawMinDeliveryDays,
      maxDeliveryDays: rawMaxDeliveryDays,
      config: {},
      ranges: this.resolveRanges(input.ranges, existing),
    };

    switch (type) {
      case 'flat_rate': {
        const cost = this.resolveMoney(input.cost, this.readMoney(baseConfig, 'cost'));
        payload.config = { cost };
        payload.ranges = [];
        break;
      }

      case 'by_weight': {
        const baseCost = this.resolveMoney(input.baseCost, this.readMoney(baseConfig, 'baseCost'));
        const costPerKg = this.resolveMoney(
          input.costPerKg,
          this.readMoney(baseConfig, 'costPerKg'),
        );
        const minCost = this.resolveOptionalMoney(
          input.minCost,
          this.readOptionalMoney(baseConfig, 'minCost'),
        );
        const maxCost = this.resolveOptionalMoney(
          input.maxCost,
          this.readOptionalMoney(baseConfig, 'maxCost'),
        );
        if (minCost !== null && maxCost !== null && maxCost < minCost) {
          throw new BadRequestException('maxCost must be greater than or equal to minCost');
        }
        payload.config = {
          baseCost,
          costPerKg,
          ...(minCost !== null ? { minCost } : {}),
          ...(maxCost !== null ? { maxCost } : {}),
        };
        payload.ranges = [];
        break;
      }

      case 'by_item': {
        const baseCost = this.resolveMoney(input.baseCost, this.readMoney(baseConfig, 'baseCost'));
        const costPerItem = this.resolveMoney(
          input.costPerItem,
          this.readMoney(baseConfig, 'costPerItem'),
        );
        const minCost = this.resolveOptionalMoney(
          input.minCost,
          this.readOptionalMoney(baseConfig, 'minCost'),
        );
        const maxCost = this.resolveOptionalMoney(
          input.maxCost,
          this.readOptionalMoney(baseConfig, 'maxCost'),
        );
        if (minCost !== null && maxCost !== null && maxCost < minCost) {
          throw new BadRequestException('maxCost must be greater than or equal to minCost');
        }
        payload.config = {
          baseCost,
          costPerItem,
          ...(minCost !== null ? { minCost } : {}),
          ...(maxCost !== null ? { maxCost } : {}),
        };
        payload.ranges = [];
        break;
      }

      case 'weight_tier':
      case 'order_value_tier': {
        if (payload.ranges.length === 0) {
          throw new BadRequestException('At least one range is required for tier methods');
        }
        this.assertRangesValid(payload.ranges);
        payload.config = {};
        break;
      }

      case 'free_shipping': {
        const conditionType = this.resolveFreeShippingConditionType(
          input.freeShippingConditionType,
          this.readCondition(baseConfig),
        );
        const minOrderAmount = this.resolveOptionalMoney(
          input.freeShippingMinOrderAmount,
          this.readOptionalMoney(baseConfig, 'minOrderAmount'),
        );

        if (conditionType === 'min_order_amount' && minOrderAmount === null) {
          throw new BadRequestException(
            'freeShippingMinOrderAmount is required for min_order_amount condition',
          );
        }

        payload.config = {
          conditionType,
          ...(conditionType === 'min_order_amount' && minOrderAmount !== null
            ? { minOrderAmount }
            : {}),
        };
        payload.ranges = [];
        break;
      }

      case 'store_pickup': {
        const pickupCost = this.resolveMoney(
          input.pickupCost,
          this.readMoney(baseConfig, 'pickupCost'),
        );
        payload.config = { pickupCost };
        payload.ranges = [];
        break;
      }

      default:
        throw new BadRequestException('Unsupported shipping method type');
    }

    return payload;
  }

  private resolveRanges(
    nextRanges: CreateShippingMethodDto['ranges'],
    existing?: ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] },
  ): NormalizedRangeInput[] {
    if (nextRanges && nextRanges.length > 0) {
      return nextRanges.map((range, index) => ({
        min: Number(range.min.toFixed(3)),
        max: range.max === undefined ? null : Number(range.max.toFixed(3)),
        cost: Number(range.cost.toFixed(2)),
        sortOrder: range.sortOrder ?? index,
      }));
    }

    if (!existing || existing.ranges.length === 0) {
      return [];
    }

    return existing.ranges.map((range, index) => ({
      min: Number(range.range_min),
      max: range.range_max === null ? null : Number(range.range_max),
      cost: Number(range.cost),
      sortOrder: range.sort_order ?? index,
    }));
  }

  private assertRangesValid(ranges: NormalizedRangeInput[]): void {
    const sorted = [...ranges].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.min - b.min;
    });

    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i]!;
      if (current.max !== null && current.max < current.min) {
        throw new BadRequestException('Each range max must be greater than or equal to min');
      }

      const next = sorted[i + 1];
      if (!next) {
        continue;
      }

      const currentMax = current.max;
      if (currentMax === null) {
        throw new BadRequestException('Open-ended range must be the last range');
      }

      if (next.min < currentMax) {
        throw new BadRequestException('Shipping ranges must not overlap');
      }
    }
  }

  private resolveFreeShippingConditionType(
    value: FreeShippingConditionType | undefined,
    fallback: FreeShippingConditionType,
  ): FreeShippingConditionType {
    const candidate = value ?? fallback;
    if (!FREE_SHIPPING_CONDITION_TYPES.includes(candidate)) {
      throw new BadRequestException('Invalid free shipping condition type');
    }
    return candidate;
  }

  private resolveMoney(value: number | undefined, fallback: number): number {
    if (value === undefined) {
      return fallback;
    }
    return Number(value.toFixed(2));
  }

  private resolveOptionalMoney(value: number | undefined, fallback: number | null): number | null {
    if (value === undefined) {
      return fallback;
    }
    return Number(value.toFixed(2));
  }

  private readMoney(config: Record<string, unknown>, key: string): number {
    const candidate = config[key];
    if (candidate === undefined || candidate === null) {
      return 0;
    }
    return Number(candidate);
  }

  private readOptionalMoney(config: Record<string, unknown>, key: string): number | null {
    const candidate = config[key];
    if (candidate === undefined || candidate === null) {
      return null;
    }
    return Number(candidate);
  }

  private readCondition(config: Record<string, unknown>): FreeShippingConditionType {
    const condition = String(config.conditionType ?? 'none') as FreeShippingConditionType;
    return FREE_SHIPPING_CONDITION_TYPES.includes(condition) ? condition : 'none';
  }

  private async requireZone(storeId: string, zoneId: string): Promise<void> {
    const zone = await this.shippingRepository.findById(storeId, zoneId);
    if (!zone) {
      throw new NotFoundException('Shipping zone not found');
    }
  }

  private async log(
    action: string,
    currentUser: AuthUser,
    targetId: string,
    context: RequestContextData,
    targetType: 'shipping_zone' | 'shipping_method',
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType,
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(row: ShippingZoneRecord): ShippingZoneResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      city: row.city,
      area: row.area,
      description: row.description,
      fee: Number(row.fee),
      isActive: row.is_active,
    };
  }

  private mapMethod(
    row: ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] },
  ): ShippingMethodResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      shippingZoneId: row.shipping_zone_id,
      type: row.method_type,
      displayName: row.display_name,
      description: row.description,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      minDeliveryDays: row.min_delivery_days,
      maxDeliveryDays: row.max_delivery_days,
      config: row.config ?? {},
      ranges: row.ranges.map((range) => ({
        min: Number(range.range_min),
        max: range.range_max === null ? null : Number(range.range_max),
        cost: Number(range.cost),
        sortOrder: range.sort_order,
      })),
    };
  }

  private buildUpdatePayload(
    storeId: string,
    zoneId: string,
    input: UpdateShippingZoneDto,
    existing: ShippingZoneRecord,
  ): {
    storeId: string;
    zoneId: string;
    name: string;
    city: string | null;
    area: string | null;
    description: string | null;
    fee: number;
    isActive: boolean;
  } {
    return {
      storeId,
      zoneId,
      name: input.name?.trim() ?? existing.name,
      city: input.city?.trim() ?? existing.city,
      area: input.area?.trim() ?? existing.area,
      description: input.description?.trim() ?? existing.description,
      fee: input.fee ?? Number(existing.fee),
      isActive: input.isActive ?? existing.is_active,
    };
  }
}
