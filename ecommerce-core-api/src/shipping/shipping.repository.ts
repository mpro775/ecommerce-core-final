import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { ShippingMethodType } from './constants/shipping-method.constants';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface ShippingZoneRecord {
  id: string;
  store_id: string;
  name: string;
  city: string | null;
  area: string | null;
  description: string | null;
  fee: string;
  is_active: boolean;
}

export interface ShippingMethodRecord {
  id: string;
  store_id: string;
  shipping_zone_id: string;
  method_type: ShippingMethodType;
  display_name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  min_delivery_days: number;
  max_delivery_days: number;
  config: Record<string, unknown>;
}

export interface ShippingMethodRangeRecord {
  id: string;
  store_id: string;
  shipping_method_id: string;
  range_min: string;
  range_max: string | null;
  cost: string;
  sort_order: number;
}

@Injectable()
export class ShippingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async create(input: {
    storeId: string;
    name: string;
    city: string | null;
    area: string | null;
    description: string | null;
    fee: number;
    isActive: boolean;
  }): Promise<ShippingZoneRecord> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        INSERT INTO shipping_zones (id, store_id, name, city, area, description, fee, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, store_id, name, city, area, description, fee, is_active
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.city,
        input.area,
        input.description,
        input.fee,
        input.isActive,
      ],
    );
    return result.rows[0] as ShippingZoneRecord;
  }

  async list(storeId: string, q?: string): Promise<ShippingZoneRecord[]> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        SELECT id, store_id, name, city, area, description, fee, is_active
        FROM shipping_zones
        WHERE store_id = $1
          AND (
            $2::text IS NULL
            OR name ILIKE '%' || $2 || '%'
            OR city ILIKE '%' || $2 || '%'
            OR area ILIKE '%' || $2 || '%'
            OR description ILIKE '%' || $2 || '%'
          )
        ORDER BY created_at DESC
      `,
      [storeId, q ?? null],
    );
    return result.rows;
  }

  async listActive(storeId: string): Promise<ShippingZoneRecord[]> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        SELECT id, store_id, name, city, area, description, fee, is_active
        FROM shipping_zones
        WHERE store_id = $1
          AND is_active = TRUE
        ORDER BY created_at ASC
      `,
      [storeId],
    );
    return result.rows;
  }

  async findById(storeId: string, zoneId: string): Promise<ShippingZoneRecord | null> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        SELECT id, store_id, name, city, area, description, fee, is_active
        FROM shipping_zones
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, zoneId],
    );
    return result.rows[0] ?? null;
  }

  async findActiveById(storeId: string, zoneId: string): Promise<ShippingZoneRecord | null> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        SELECT id, store_id, name, city, area, description, fee, is_active
        FROM shipping_zones
        WHERE store_id = $1
          AND id = $2
          AND is_active = TRUE
        LIMIT 1
      `,
      [storeId, zoneId],
    );
    return result.rows[0] ?? null;
  }

  async update(input: {
    storeId: string;
    zoneId: string;
    name: string;
    city: string | null;
    area: string | null;
    description: string | null;
    fee: number;
    isActive: boolean;
  }): Promise<ShippingZoneRecord | null> {
    const result = await this.databaseService.db.query<ShippingZoneRecord>(
      `
        UPDATE shipping_zones
        SET name = $3,
            city = $4,
            area = $5,
            description = $6,
            fee = $7,
            is_active = $8,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, name, city, area, description, fee, is_active
      `,
      [
        input.storeId,
        input.zoneId,
        input.name,
        input.city,
        input.area,
        input.description,
        input.fee,
        input.isActive,
      ],
    );
    return result.rows[0] ?? null;
  }

  async delete(storeId: string, zoneId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM shipping_zones
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, zoneId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listMethodsByZone(
    storeId: string,
    zoneId: string,
    onlyActive = false,
  ): Promise<Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>> {
    const methodsResult = await this.databaseService.db.query<ShippingMethodRecord>(
      `
        SELECT id, store_id, shipping_zone_id, method_type, display_name, description, is_active, sort_order,
               min_delivery_days, max_delivery_days, config
        FROM shipping_methods
        WHERE store_id = $1
          AND shipping_zone_id = $2
          AND ($3::boolean = FALSE OR is_active = TRUE)
        ORDER BY sort_order ASC, created_at ASC
      `,
      [storeId, zoneId, onlyActive],
    );

    const methods = methodsResult.rows;
    if (methods.length === 0) {
      return [];
    }

    const methodIds = methods.map((method) => method.id);
    const rangesResult = await this.databaseService.db.query<ShippingMethodRangeRecord>(
      `
        SELECT id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
        FROM shipping_method_ranges
        WHERE store_id = $1
          AND shipping_method_id = ANY($2::uuid[])
        ORDER BY sort_order ASC, range_min ASC, created_at ASC
      `,
      [storeId, methodIds],
    );

    const rangesByMethodId = new Map<string, ShippingMethodRangeRecord[]>();
    for (const range of rangesResult.rows) {
      const list = rangesByMethodId.get(range.shipping_method_id);
      if (list) {
        list.push(range);
      } else {
        rangesByMethodId.set(range.shipping_method_id, [range]);
      }
    }

    return methods.map((method) => ({
      ...method,
      ranges: rangesByMethodId.get(method.id) ?? [],
    }));
  }

  async findMethodById(
    storeId: string,
    zoneId: string,
    methodId: string,
  ): Promise<(ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }) | null> {
    const result = await this.databaseService.db.query<ShippingMethodRecord>(
      `
        SELECT id, store_id, shipping_zone_id, method_type, display_name, description, is_active, sort_order,
               min_delivery_days, max_delivery_days, config
        FROM shipping_methods
        WHERE store_id = $1
          AND shipping_zone_id = $2
          AND id = $3
        LIMIT 1
      `,
      [storeId, zoneId, methodId],
    );

    const method = result.rows[0];
    if (!method) {
      return null;
    }

    const rangesResult = await this.databaseService.db.query<ShippingMethodRangeRecord>(
      `
        SELECT id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
        FROM shipping_method_ranges
        WHERE store_id = $1
          AND shipping_method_id = $2
        ORDER BY sort_order ASC, range_min ASC, created_at ASC
      `,
      [storeId, methodId],
    );

    return {
      ...method,
      ranges: rangesResult.rows,
    };
  }

  async createMethod(
    db: Queryable,
    input: {
      storeId: string;
      zoneId: string;
      methodType: ShippingMethodType;
      displayName: string;
      description: string | null;
      isActive: boolean;
      sortOrder: number;
      minDeliveryDays: number;
      maxDeliveryDays: number;
      config: Record<string, unknown>;
      ranges: Array<{ min: number; max: number | null; cost: number; sortOrder: number }>;
    },
  ): Promise<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }> {
    const methodId = uuidv4();
    const methodResult = await db.query<ShippingMethodRecord>(
      `
        INSERT INTO shipping_methods (
          id, store_id, shipping_zone_id, method_type, display_name, description, is_active,
          sort_order, min_delivery_days, max_delivery_days, config
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        RETURNING id, store_id, shipping_zone_id, method_type, display_name, description, is_active, sort_order,
               min_delivery_days, max_delivery_days, config
      `,
      [
        methodId,
        input.storeId,
        input.zoneId,
        input.methodType,
        input.displayName,
        input.description,
        input.isActive,
        input.sortOrder,
        input.minDeliveryDays,
        input.maxDeliveryDays,
        JSON.stringify(input.config),
      ],
    );

    if (input.ranges.length > 0) {
      for (const range of input.ranges) {
        await db.query(
          `
            INSERT INTO shipping_method_ranges (
              id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [uuidv4(), input.storeId, methodId, range.min, range.max, range.cost, range.sortOrder],
        );
      }
    }

    const created = methodResult.rows[0] as ShippingMethodRecord;
    const ranges = await this.fetchMethodRanges(db, input.storeId, methodId);
    return { ...created, ranges };
  }

  async updateMethod(
    db: Queryable,
    input: {
      storeId: string;
      zoneId: string;
      methodId: string;
      methodType: ShippingMethodType;
      displayName: string;
      description: string | null;
      isActive: boolean;
      sortOrder: number;
      minDeliveryDays: number;
      maxDeliveryDays: number;
      config: Record<string, unknown>;
      ranges: Array<{ min: number; max: number | null; cost: number; sortOrder: number }>;
    },
  ): Promise<(ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }) | null> {
    const result = await db.query<ShippingMethodRecord>(
      `
        UPDATE shipping_methods
        SET method_type = $4,
            display_name = $5,
            description = $6,
            is_active = $7,
            sort_order = $8,
            min_delivery_days = $9,
            max_delivery_days = $10,
            config = $11::jsonb,
            updated_at = NOW()
        WHERE store_id = $1
          AND shipping_zone_id = $2
          AND id = $3
        RETURNING id, store_id, shipping_zone_id, method_type, display_name, description, is_active, sort_order,
               min_delivery_days, max_delivery_days, config
      `,
      [
        input.storeId,
        input.zoneId,
        input.methodId,
        input.methodType,
        input.displayName,
        input.description,
        input.isActive,
        input.sortOrder,
        input.minDeliveryDays,
        input.maxDeliveryDays,
        JSON.stringify(input.config),
      ],
    );

    const method = result.rows[0];
    if (!method) {
      return null;
    }

    await db.query(
      `
        DELETE FROM shipping_method_ranges
        WHERE store_id = $1
          AND shipping_method_id = $2
      `,
      [input.storeId, input.methodId],
    );

    if (input.ranges.length > 0) {
      for (const range of input.ranges) {
        await db.query(
          `
            INSERT INTO shipping_method_ranges (
              id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            uuidv4(),
            input.storeId,
            input.methodId,
            range.min,
            range.max,
            range.cost,
            range.sortOrder,
          ],
        );
      }
    }

    const ranges = await this.fetchMethodRanges(db, input.storeId, input.methodId);
    return { ...method, ranges };
  }

  async deleteMethod(storeId: string, zoneId: string, methodId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM shipping_methods
        WHERE store_id = $1
          AND shipping_zone_id = $2
          AND id = $3
      `,
      [storeId, zoneId, methodId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async findMethodAcrossZones(
    storeId: string,
    methodId: string,
  ): Promise<(ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }) | null> {
    const result = await this.databaseService.db.query<ShippingMethodRecord>(
      `
        SELECT id, store_id, shipping_zone_id, method_type, display_name, description, is_active, sort_order,
               min_delivery_days, max_delivery_days, config
        FROM shipping_methods
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, methodId],
    );

    const method = result.rows[0];
    if (!method) {
      return null;
    }

    const ranges = await this.fetchMethodRanges(this.databaseService.db, storeId, methodId);
    return { ...method, ranges };
  }

  async listActiveMethodsAcrossZones(
    storeId: string,
  ): Promise<Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>> {
    const methodsResult = await this.databaseService.db.query<ShippingMethodRecord>(
      `
        SELECT sm.id, sm.store_id, sm.shipping_zone_id, sm.method_type, sm.display_name,
               sm.description, sm.is_active, sm.sort_order, sm.min_delivery_days,
               sm.max_delivery_days, sm.config
        FROM shipping_methods sm
        INNER JOIN shipping_zones sz
          ON sz.id = sm.shipping_zone_id
         AND sz.store_id = sm.store_id
        WHERE sm.store_id = $1
          AND sm.is_active = TRUE
          AND sz.is_active = TRUE
        ORDER BY sm.sort_order ASC, sm.created_at ASC
      `,
      [storeId],
    );

    const methods = methodsResult.rows;
    if (methods.length === 0) {
      return [];
    }

    const methodIds = methods.map((method) => method.id);
    const rangesResult = await this.databaseService.db.query<ShippingMethodRangeRecord>(
      `
        SELECT id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
        FROM shipping_method_ranges
        WHERE store_id = $1
          AND shipping_method_id = ANY($2::uuid[])
        ORDER BY sort_order ASC, range_min ASC, created_at ASC
      `,
      [storeId, methodIds],
    );

    const rangesByMethodId = new Map<string, ShippingMethodRangeRecord[]>();
    for (const range of rangesResult.rows) {
      const ranges = rangesByMethodId.get(range.shipping_method_id);
      if (ranges) {
        ranges.push(range);
      } else {
        rangesByMethodId.set(range.shipping_method_id, [range]);
      }
    }

    return methods.map((method) => ({
      ...method,
      ranges: rangesByMethodId.get(method.id) ?? [],
    }));
  }

  private async fetchMethodRanges(
    db: Queryable,
    storeId: string,
    methodId: string,
  ): Promise<ShippingMethodRangeRecord[]> {
    const result = await db.query<ShippingMethodRangeRecord>(
      `
        SELECT id, store_id, shipping_method_id, range_min, range_max, cost, sort_order
        FROM shipping_method_ranges
        WHERE store_id = $1
          AND shipping_method_id = $2
        ORDER BY sort_order ASC, range_min ASC, created_at ASC
      `,
      [storeId, methodId],
    );

    return result.rows;
  }
}
