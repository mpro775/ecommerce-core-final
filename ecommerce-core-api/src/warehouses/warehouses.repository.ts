import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface WarehouseRecord {
  id: string;
  store_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  code: string;
  is_default: boolean;
  is_active: boolean;
  address: string | null;
  short_address: string | null;
  city: string | null;
  country: string | null;
  branch: string | null;
  district: string | null;
  street: string | null;
  phone: string | null;
  email: string | null;
  geolocation: Record<string, unknown> | null;
  latitude: string | null;
  longitude: string | null;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface ProductWarehouseLinkRecord {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  warehouse_name_ar: string | null;
  warehouse_name_en: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface VariantWarehouseAllocationRecord {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  warehouse_name_ar: string | null;
  warehouse_name_en: string | null;
  is_default: boolean;
  is_active: boolean;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number | null;
  reorder_point: number | null;
}

export interface VariantRecord {
  id: string;
  product_id: string;
  low_stock_threshold: number;
  stock_quantity: number;
}

export interface ProductRecord {
  id: string;
}

@Injectable()
export class WarehousesRepository {
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

  async listByStore(storeId: string): Promise<WarehouseRecord[]> {
    const result = await this.databaseService.db.query<WarehouseRecord>(
      `
        SELECT
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
        FROM warehouses
        WHERE store_id = $1
        ORDER BY is_default DESC, priority DESC, created_at ASC
      `,
      [storeId],
    );
    return result.rows;
  }

  async findById(storeId: string, warehouseId: string): Promise<WarehouseRecord | null> {
    const result = await this.databaseService.db.query<WarehouseRecord>(
      `
        SELECT
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
        FROM warehouses
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, warehouseId],
    );
    return result.rows[0] ?? null;
  }

  async findDefaultByStore(storeId: string): Promise<WarehouseRecord | null> {
    const result = await this.databaseService.db.query<WarehouseRecord>(
      `
        SELECT
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
        FROM warehouses
        WHERE store_id = $1
          AND is_default = TRUE
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async findBestForProduct(storeId: string, productId: string): Promise<WarehouseRecord | null> {
    const result = await this.databaseService.db.query<WarehouseRecord>(
      `
        SELECT
          w.id,
          w.store_id,
          w.name,
          w.name_ar,
          w.name_en,
          w.code,
          w.is_default,
          w.is_active,
          w.address,
          w.short_address,
          w.city,
          w.country,
          w.branch,
          w.district,
          w.street,
          w.phone,
          w.email,
          w.geolocation,
          w.latitude,
          w.longitude,
          w.priority,
          w.created_at,
          w.updated_at
        FROM warehouse_product_links l
        INNER JOIN warehouses w ON w.id = l.warehouse_id
        WHERE l.store_id = $1
          AND l.product_id = $2
          AND w.is_active = TRUE
        ORDER BY w.is_default DESC, w.priority DESC, w.created_at ASC
        LIMIT 1
      `,
      [storeId, productId],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }

    return this.findDefaultByStore(storeId);
  }

  async create(
    db: Queryable,
    input: {
      storeId: string;
      name: string;
      nameAr: string;
      nameEn: string;
      code: string;
      address: string | null;
      shortAddress: string | null;
      city: string;
      country: string;
      branch: string | null;
      district: string | null;
      street: string | null;
      phone: string | null;
      email: string | null;
      geolocation: Record<string, unknown>;
      latitude: number;
      longitude: number;
      isDefault: boolean;
      isActive: boolean;
      priority: number;
    },
  ): Promise<WarehouseRecord> {
    const result = await db.query<WarehouseRecord>(
      `
        INSERT INTO warehouses (
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18::jsonb,
          $19,
          $20,
          $21
        )
        RETURNING
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.code,
        input.isDefault,
        input.isActive,
        input.address,
        input.shortAddress,
        input.city,
        input.country,
        input.branch,
        input.district,
        input.street,
        input.phone,
        input.email,
        JSON.stringify(input.geolocation),
        input.latitude,
        input.longitude,
        input.priority,
      ],
    );
    return result.rows[0] as WarehouseRecord;
  }

  async update(
    db: Queryable,
    input: {
      storeId: string;
      warehouseId: string;
      name: string;
      nameAr: string;
      nameEn: string;
      code: string;
      address: string | null;
      shortAddress: string | null;
      city: string;
      country: string;
      branch: string | null;
      district: string | null;
      street: string | null;
      phone: string | null;
      email: string | null;
      geolocation: Record<string, unknown>;
      latitude: number;
      longitude: number;
      isDefault: boolean;
      isActive: boolean;
      priority: number;
    },
  ): Promise<WarehouseRecord | null> {
    const result = await db.query<WarehouseRecord>(
      `
        UPDATE warehouses
        SET name = $3,
            name_ar = $4,
            name_en = $5,
            code = $6,
            is_default = $7,
            is_active = $8,
            address = $9,
            short_address = $10,
            city = $11,
            country = $12,
            branch = $13,
            district = $14,
            street = $15,
            phone = $16,
            email = $17,
            geolocation = $18::jsonb,
            latitude = $19,
            longitude = $20,
            priority = $21,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
      `,
      [
        input.storeId,
        input.warehouseId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.code,
        input.isDefault,
        input.isActive,
        input.address,
        input.shortAddress,
        input.city,
        input.country,
        input.branch,
        input.district,
        input.street,
        input.phone,
        input.email,
        JSON.stringify(input.geolocation),
        input.latitude,
        input.longitude,
        input.priority,
      ],
    );
    return result.rows[0] ?? null;
  }

  async unsetDefaultForStore(
    db: Queryable,
    storeId: string,
    exceptWarehouseId?: string,
  ): Promise<void> {
    await db.query(
      `
        UPDATE warehouses
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE store_id = $1
          AND ($2::uuid IS NULL OR id <> $2)
          AND is_default = TRUE
      `,
      [storeId, exceptWarehouseId ?? null],
    );
  }

  async markAsDefault(
    db: Queryable,
    storeId: string,
    warehouseId: string,
  ): Promise<WarehouseRecord | null> {
    const result = await db.query<WarehouseRecord>(
      `
        UPDATE warehouses
        SET is_default = TRUE,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING
          id,
          store_id,
          name,
          name_ar,
          name_en,
          code,
          is_default,
          is_active,
          address,
          short_address,
          city,
          country,
          branch,
          district,
          street,
          phone,
          email,
          geolocation,
          latitude,
          longitude,
          priority,
          created_at,
          updated_at
      `,
      [storeId, warehouseId],
    );
    return result.rows[0] ?? null;
  }

  async listExistingWarehouseIds(storeId: string, warehouseIds: string[]): Promise<string[]> {
    if (warehouseIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<{ id: string }>(
      `
        SELECT id
        FROM warehouses
        WHERE store_id = $1
          AND id = ANY($2::uuid[])
      `,
      [storeId, warehouseIds],
    );
    return result.rows.map((row) => row.id);
  }

  async listProductLinks(
    storeId: string,
    productId: string,
  ): Promise<ProductWarehouseLinkRecord[]> {
    const result = await this.databaseService.db.query<ProductWarehouseLinkRecord>(
      `
        SELECT
          w.id AS warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          w.name_ar AS warehouse_name_ar,
          w.name_en AS warehouse_name_en,
          w.is_default,
          w.is_active
        FROM warehouse_product_links l
        INNER JOIN warehouses w ON w.id = l.warehouse_id
        WHERE l.store_id = $1
          AND l.product_id = $2
        ORDER BY w.is_default DESC, w.priority DESC, w.created_at ASC
      `,
      [storeId, productId],
    );
    return result.rows;
  }

  async clearProductLinks(db: Queryable, storeId: string, productId: string): Promise<void> {
    await db.query(
      `
        DELETE FROM warehouse_product_links
        WHERE store_id = $1
          AND product_id = $2
      `,
      [storeId, productId],
    );
  }

  async insertProductLink(
    db: Queryable,
    input: { storeId: string; productId: string; warehouseId: string },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO warehouse_product_links (id, warehouse_id, product_id, store_id)
        VALUES ($1, $2, $3, $4)
      `,
      [uuidv4(), input.warehouseId, input.productId, input.storeId],
    );
  }

  async findProductById(storeId: string, productId: string): Promise<ProductRecord | null> {
    const result = await this.databaseService.db.query<ProductRecord>(
      `
        SELECT id
        FROM products
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, productId],
    );
    return result.rows[0] ?? null;
  }

  async countProductVariants(storeId: string, productId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM product_variants
        WHERE store_id = $1
          AND product_id = $2
      `,
      [storeId, productId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async findVariantById(storeId: string, variantId: string): Promise<VariantRecord | null> {
    const result = await this.databaseService.db.query<VariantRecord>(
      `
        SELECT id, product_id, low_stock_threshold, stock_quantity
        FROM product_variants
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, variantId],
    );
    return result.rows[0] ?? null;
  }

  async listVariantAllocations(
    storeId: string,
    variantId: string,
  ): Promise<VariantWarehouseAllocationRecord[]> {
    const result = await this.databaseService.db.query<VariantWarehouseAllocationRecord>(
      `
        SELECT
          w.id AS warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          w.name_ar AS warehouse_name_ar,
          w.name_en AS warehouse_name_en,
          w.is_default,
          w.is_active,
          wi.quantity,
          wi.reserved_quantity,
          wi.low_stock_threshold,
          wi.reorder_point
        FROM warehouse_inventory wi
        INNER JOIN warehouses w ON w.id = wi.warehouse_id
        WHERE wi.store_id = $1
          AND wi.variant_id = $2
        ORDER BY w.is_default DESC, w.priority DESC, w.created_at ASC
      `,
      [storeId, variantId],
    );
    return result.rows;
  }

  async upsertVariantAllocation(
    db: Queryable,
    input: {
      storeId: string;
      warehouseId: string;
      variantId: string;
      quantity: number;
      reservedQuantity: number;
      lowStockThreshold: number;
      reorderPoint: number | null;
    },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO warehouse_inventory (
          id,
          warehouse_id,
          variant_id,
          store_id,
          quantity,
          reserved_quantity,
          low_stock_threshold,
          reorder_point
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (warehouse_id, variant_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          low_stock_threshold = EXCLUDED.low_stock_threshold,
          reorder_point = EXCLUDED.reorder_point,
          updated_at = NOW()
      `,
      [
        uuidv4(),
        input.warehouseId,
        input.variantId,
        input.storeId,
        input.quantity,
        input.reservedQuantity,
        input.lowStockThreshold,
        input.reorderPoint,
      ],
    );
  }

  async deleteVariantAllocationsNotInWarehouses(
    db: Queryable,
    input: { storeId: string; variantId: string; warehouseIds: string[] },
  ): Promise<void> {
    if (input.warehouseIds.length === 0) {
      await db.query(
        `
          DELETE FROM warehouse_inventory
          WHERE store_id = $1
            AND variant_id = $2
        `,
        [input.storeId, input.variantId],
      );
      return;
    }

    await db.query(
      `
        DELETE FROM warehouse_inventory
        WHERE store_id = $1
          AND variant_id = $2
          AND warehouse_id <> ALL($3::uuid[])
      `,
      [input.storeId, input.variantId, input.warehouseIds],
    );
  }

  async updateVariantStockQuantity(
    db: Queryable,
    input: { storeId: string; variantId: string; stockQuantity: number },
  ): Promise<void> {
    await db.query(
      `
        UPDATE product_variants
        SET stock_quantity = $3,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
      `,
      [input.storeId, input.variantId, input.stockQuantity],
    );
  }

  async upsertVariantAllocationInWarehouse(
    db: Queryable,
    input: {
      storeId: string;
      warehouseId: string;
      variantId: string;
      quantity: number;
      lowStockThreshold: number;
    },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO warehouse_inventory (
          id,
          warehouse_id,
          variant_id,
          store_id,
          quantity,
          reserved_quantity,
          low_stock_threshold
        )
        VALUES ($1, $2, $3, $4, $5, 0, $6)
        ON CONFLICT (warehouse_id, variant_id)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          low_stock_threshold = EXCLUDED.low_stock_threshold,
          updated_at = NOW()
      `,
      [
        uuidv4(),
        input.warehouseId,
        input.variantId,
        input.storeId,
        input.quantity,
        input.lowStockThreshold,
      ],
    );
  }

  async updateWarehousePriority(
    db: Queryable,
    input: { storeId: string; warehouseId: string; priority: number },
  ): Promise<void> {
    await db.query(
      `
        UPDATE warehouses
        SET priority = $3,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
      `,
      [input.storeId, input.warehouseId, input.priority],
    );
  }
}
