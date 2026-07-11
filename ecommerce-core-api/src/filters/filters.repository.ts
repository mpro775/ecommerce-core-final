import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { FilterSourceType, FilterType } from './constants/filter-type.constants';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface FilterRecord {
  id: string;
  store_id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  type: FilterType;
  sort_order: number;
  is_active: boolean;
  source_type: FilterSourceType;
  source_attribute_id: string | null;
  source_key: string | null;
  display_type: string | null;
  is_system: boolean;
}

export interface FilterValueRecord {
  id: string;
  store_id: string;
  filter_id: string;
  value_ar: string;
  value_en: string;
  slug: string;
  color_hex: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface FilterValueWithFilterRecord extends FilterValueRecord {
  filter_slug: string;
  filter_type: FilterType;
}

export interface ProductFilterRangeRecord {
  filter_id: string;
  filter_slug: string;
  numeric_value: string;
}

const FILTER_COLUMNS =
  'id, store_id, name_ar, name_en, slug, type, sort_order, is_active, source_type, source_attribute_id, source_key, display_type, is_system';
const FILTER_VALUE_COLUMNS =
  'id, store_id, filter_id, value_ar, value_en, slug, color_hex, sort_order, is_active';

@Injectable()
export class FiltersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listFilters(
    storeId: string,
    options?: { q?: string; onlyActive?: boolean },
  ): Promise<FilterRecord[]> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        SELECT ${FILTER_COLUMNS}
        FROM filters
        WHERE store_id = $1
          AND ($2::text IS NULL OR name_ar ILIKE '%' || $2 || '%' OR name_en ILIKE '%' || $2 || '%' OR slug ILIKE '%' || $2 || '%')
          AND ($3::boolean IS NULL OR is_active = $3)
        ORDER BY sort_order ASC, created_at ASC
      `,
      [storeId, options?.q?.trim() ?? null, options?.onlyActive ?? null],
    );

    return result.rows;
  }

  async findFilterById(storeId: string, filterId: string): Promise<FilterRecord | null> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        SELECT ${FILTER_COLUMNS}
        FROM filters
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, filterId],
    );

    return result.rows[0] ?? null;
  }

  async findFilterBySlug(storeId: string, slug: string): Promise<FilterRecord | null> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        SELECT ${FILTER_COLUMNS}
        FROM filters
        WHERE store_id = $1
          AND slug = $2
        LIMIT 1
      `,
      [storeId, slug],
    );

    return result.rows[0] ?? null;
  }

  async findFilterBySourceType(storeId: string, sourceType: string): Promise<FilterRecord | null> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        SELECT ${FILTER_COLUMNS}
        FROM filters
        WHERE store_id = $1
          AND source_type = $2
        LIMIT 1
      `,
      [storeId, sourceType],
    );

    return result.rows[0] ?? null;
  }

  async findFilterBySourceAttributeId(
    storeId: string,
    sourceAttributeId: string,
  ): Promise<FilterRecord | null> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        SELECT ${FILTER_COLUMNS}
        FROM filters
        WHERE store_id = $1
          AND source_type = 'attribute'
          AND source_attribute_id = $2
        LIMIT 1
      `,
      [storeId, sourceAttributeId],
    );

    return result.rows[0] ?? null;
  }

  async createFilter(input: {
    storeId: string;
    nameAr: string;
    nameEn: string;
    slug: string;
    type: FilterType;
    sortOrder: number;
    isActive: boolean;
    sourceType: FilterSourceType;
    sourceAttributeId?: string | null;
    sourceKey?: string | null;
    displayType?: string | null;
    isSystem?: boolean;
  }): Promise<FilterRecord> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        INSERT INTO filters (id, store_id, name_ar, name_en, slug, type, sort_order, is_active, source_type, source_attribute_id, source_key, display_type, is_system)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING ${FILTER_COLUMNS}
      `,
      [
        uuidv4(),
        input.storeId,
        input.nameAr,
        input.nameEn,
        input.slug,
        input.type,
        input.sortOrder,
        input.isActive,
        input.sourceType,
        input.sourceAttributeId ?? null,
        input.sourceKey ?? null,
        input.displayType ?? null,
        input.isSystem ?? false,
      ],
    );

    return result.rows[0] as FilterRecord;
  }

  async updateFilter(input: {
    storeId: string;
    filterId: string;
    nameAr: string;
    nameEn: string;
    slug: string;
    type: FilterType;
    sortOrder: number;
    isActive: boolean;
    sourceType: FilterSourceType;
    sourceAttributeId?: string | null;
    sourceKey?: string | null;
    displayType?: string | null;
    isSystem?: boolean;
  }): Promise<FilterRecord | null> {
    const result = await this.databaseService.db.query<FilterRecord>(
      `
        UPDATE filters
        SET name_ar = $3,
            name_en = $4,
            slug = $5,
            type = $6,
            sort_order = $7,
            is_active = $8,
            source_type = $9,
            source_attribute_id = $10,
            source_key = $11,
            display_type = $12,
            is_system = $13,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING ${FILTER_COLUMNS}
      `,
      [
        input.storeId,
        input.filterId,
        input.nameAr,
        input.nameEn,
        input.slug,
        input.type,
        input.sortOrder,
        input.isActive,
        input.sourceType,
        input.sourceAttributeId ?? null,
        input.sourceKey ?? null,
        input.displayType ?? null,
        input.isSystem ?? false,
      ],
    );

    return result.rows[0] ?? null;
  }

  async deleteFilter(storeId: string, filterId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM filters
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, filterId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listFilterValues(storeId: string, filterId: string): Promise<FilterValueRecord[]> {
    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        SELECT ${FILTER_VALUE_COLUMNS}
        FROM filter_values
        WHERE store_id = $1
          AND filter_id = $2
        ORDER BY sort_order ASC, created_at ASC
      `,
      [storeId, filterId],
    );

    return result.rows;
  }

  async findFilterValueById(storeId: string, valueId: string): Promise<FilterValueRecord | null> {
    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        SELECT ${FILTER_VALUE_COLUMNS}
        FROM filter_values
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, valueId],
    );

    return result.rows[0] ?? null;
  }

  async findFilterValueBySlug(
    storeId: string,
    filterId: string,
    slug: string,
  ): Promise<FilterValueRecord | null> {
    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        SELECT ${FILTER_VALUE_COLUMNS}
        FROM filter_values
        WHERE store_id = $1
          AND filter_id = $2
          AND slug = $3
        LIMIT 1
      `,
      [storeId, filterId, slug],
    );

    return result.rows[0] ?? null;
  }

  async createFilterValue(input: {
    storeId: string;
    filterId: string;
    valueAr: string;
    valueEn: string;
    slug: string;
    colorHex: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<FilterValueRecord> {
    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        INSERT INTO filter_values (
          id,
          store_id,
          filter_id,
          value_ar,
          value_en,
          slug,
          color_hex,
          sort_order,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${FILTER_VALUE_COLUMNS}
      `,
      [
        uuidv4(),
        input.storeId,
        input.filterId,
        input.valueAr,
        input.valueEn,
        input.slug,
        input.colorHex,
        input.sortOrder,
        input.isActive,
      ],
    );

    return result.rows[0] as FilterValueRecord;
  }

  async updateFilterValue(input: {
    storeId: string;
    valueId: string;
    valueAr: string;
    valueEn: string;
    slug: string;
    colorHex: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<FilterValueRecord | null> {
    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        UPDATE filter_values
        SET value_ar = $3,
            value_en = $4,
            slug = $5,
            color_hex = $6,
            sort_order = $7,
            is_active = $8,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING ${FILTER_VALUE_COLUMNS}
      `,
      [
        input.storeId,
        input.valueId,
        input.valueAr,
        input.valueEn,
        input.slug,
        input.colorHex,
        input.sortOrder,
        input.isActive,
      ],
    );

    return result.rows[0] ?? null;
  }

  async deleteFilterValue(storeId: string, valueId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM filter_values
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, valueId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listFilterValuesByIds(
    storeId: string,
    valueIds: string[],
  ): Promise<FilterValueWithFilterRecord[]> {
    if (valueIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<FilterValueWithFilterRecord>(
      `
        SELECT
          fv.id,
          fv.store_id,
          fv.filter_id,
          fv.value_ar,
          fv.value_en,
          fv.slug,
          fv.color_hex,
          fv.sort_order,
          fv.is_active,
          f.slug AS filter_slug,
          f.type AS filter_type
        FROM filter_values fv
        INNER JOIN filters f
          ON f.id = fv.filter_id
         AND f.store_id = fv.store_id
        WHERE fv.store_id = $1
          AND fv.id = ANY($2::uuid[])
      `,
      [storeId, valueIds],
    );

    return result.rows;
  }

  async listFilterValuesByFilterIds(
    storeId: string,
    filterIds: string[],
    onlyActive: boolean,
  ): Promise<FilterValueRecord[]> {
    if (filterIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<FilterValueRecord>(
      `
        SELECT ${FILTER_VALUE_COLUMNS}
        FROM filter_values
        WHERE store_id = $1
          AND filter_id = ANY($2::uuid[])
          AND ($3::boolean = FALSE OR is_active = TRUE)
        ORDER BY sort_order ASC, created_at ASC
      `,
      [storeId, filterIds, onlyActive],
    );

    return result.rows;
  }

  async listProductFilterValues(
    storeId: string,
    productId: string,
  ): Promise<FilterValueWithFilterRecord[]> {
    const result = await this.databaseService.db.query<FilterValueWithFilterRecord>(
      `
        SELECT
          fv.id,
          fv.store_id,
          fv.filter_id,
          fv.value_ar,
          fv.value_en,
          fv.slug,
          fv.color_hex,
          fv.sort_order,
          fv.is_active,
          f.slug AS filter_slug,
          f.type AS filter_type
        FROM product_filter_values pfv
        INNER JOIN filter_values fv
          ON fv.id = pfv.filter_value_id
         AND fv.store_id = pfv.store_id
        INNER JOIN filters f
          ON f.id = fv.filter_id
         AND f.store_id = fv.store_id
        WHERE pfv.store_id = $1
          AND pfv.product_id = $2
        ORDER BY f.sort_order ASC, fv.sort_order ASC
      `,
      [storeId, productId],
    );

    return result.rows;
  }

  async listProductFilterRanges(
    storeId: string,
    productId: string,
  ): Promise<ProductFilterRangeRecord[]> {
    const result = await this.databaseService.db.query<ProductFilterRangeRecord>(
      `
        SELECT
          pfr.filter_id,
          f.slug AS filter_slug,
          pfr.numeric_value::text AS numeric_value
        FROM product_filter_ranges pfr
        INNER JOIN filters f
          ON f.id = pfr.filter_id
         AND f.store_id = pfr.store_id
        WHERE pfr.store_id = $1
          AND pfr.product_id = $2
        ORDER BY f.sort_order ASC
      `,
      [storeId, productId],
    );

    return result.rows;
  }

  async replaceProductFilterSelections(input: {
    storeId: string;
    productId: string;
    valueIds: string[];
    ranges: Array<{ filterId: string; numericValue: number }>;
  }): Promise<void> {
    await this.withTransaction(async (db) => {
      await db.query(
        `
          DELETE FROM product_filter_values
          WHERE store_id = $1
            AND product_id = $2
        `,
        [input.storeId, input.productId],
      );

      await db.query(
        `
          DELETE FROM product_filter_ranges
          WHERE store_id = $1
            AND product_id = $2
        `,
        [input.storeId, input.productId],
      );

      for (const valueId of input.valueIds) {
        await db.query(
          `
            INSERT INTO product_filter_values (id, store_id, product_id, filter_value_id)
            VALUES ($1, $2, $3, $4)
          `,
          [uuidv4(), input.storeId, input.productId, valueId],
        );
      }

      for (const range of input.ranges) {
        await db.query(
          `
            INSERT INTO product_filter_ranges (id, store_id, product_id, filter_id, numeric_value)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [uuidv4(), input.storeId, input.productId, range.filterId, range.numericValue],
        );
      }
    });
  }

  async getStorePriceRange(storeId: string): Promise<{ min: number; max: number } | null> {
    const result = await this.databaseService.db.query<{ min: string; max: string }>(
      `
        SELECT
          MIN(pv.price)::text AS min,
          MAX(pv.price)::text AS max
        FROM product_variants pv
        INNER JOIN products p
          ON p.id = pv.product_id
         AND p.store_id = pv.store_id
        WHERE pv.store_id = $1
          AND p.status = 'active'
          AND p.is_visible = TRUE
      `,
      [storeId],
    );

    const row = result.rows[0];
    if (!row || !row.min || !row.max) {
      return null;
    }

    return { min: Number(row.min), max: Number(row.max) };
  }

  async getStorePriceRangeForCategory(
    storeId: string,
    categoryId: string,
  ): Promise<{ min: number; max: number } | null> {
    const result = await this.databaseService.db.query<{ min: string; max: string }>(
      `
        SELECT
          MIN(pv.price)::text AS min,
          MAX(pv.price)::text AS max
        FROM product_variants pv
        INNER JOIN products p
          ON p.id = pv.product_id
         AND p.store_id = pv.store_id
        WHERE pv.store_id = $1
          AND p.status = 'active'
          AND p.is_visible = TRUE
          AND (p.category_id = $2 OR EXISTS (
            SELECT 1 FROM product_categories pc
            WHERE pc.store_id = p.store_id
              AND pc.product_id = p.id
              AND pc.category_id = $2
          ))
      `,
      [storeId, categoryId],
    );

    const row = result.rows[0];
    if (!row || !row.min || !row.max) {
      return null;
    }

    return { min: Number(row.min), max: Number(row.max) };
  }

  private async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
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
}
