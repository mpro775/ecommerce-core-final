import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface AttributeRecord {
  id: string;
  store_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  type: 'dropdown' | 'color';
  description_ar: string | null;
  description_en: string | null;
  is_active: boolean;
  slug: string;
}

export interface AttributeValueRecord {
  id: string;
  store_id: string;
  attribute_id: string;
  value: string;
  value_ar: string | null;
  value_en: string | null;
  color_hex: string | null;
  is_active: boolean;
  slug: string;
}

export interface AttributeValueWithAttributeRecord extends AttributeValueRecord {
  attribute_name: string;
  attribute_name_ar: string | null;
  attribute_name_en: string | null;
  attribute_type: 'dropdown' | 'color';
  attribute_is_active: boolean;
  attribute_slug: string;
}

export interface VariantAttributeSelectionRecord {
  variant_id: string;
  attribute_id: string;
  attribute_slug: string;
  attribute_value_id: string;
  value_slug: string;
}

const ATTRIBUTE_COLUMNS =
  'id, store_id, name, name_ar, name_en, type, description_ar, description_en, is_active, slug';
const ATTRIBUTE_VALUE_COLUMNS =
  'id, store_id, attribute_id, value, value_ar, value_en, color_hex, is_active, slug';

@Injectable()
export class AttributesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAttributes(
    storeId: string,
    q?: string,
    onlyActive = false,
  ): Promise<AttributeRecord[]> {
    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        SELECT ${ATTRIBUTE_COLUMNS}
        FROM attributes
        WHERE store_id = $1
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR name_ar ILIKE '%' || $2 || '%' OR name_en ILIKE '%' || $2 || '%' OR slug ILIKE '%' || $2 || '%')
          AND ($3::boolean = FALSE OR is_active = TRUE)
        ORDER BY name ASC
      `,
      [storeId, q ?? null, onlyActive],
    );

    return result.rows;
  }

  async listAttributesByIds(
    storeId: string,
    attributeIds: string[],
    onlyActive = false,
  ): Promise<AttributeRecord[]> {
    if (attributeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        SELECT ${ATTRIBUTE_COLUMNS}
        FROM attributes
        WHERE store_id = $1
          AND id = ANY($2::uuid[])
          AND ($3::boolean = FALSE OR is_active = TRUE)
        ORDER BY name ASC
      `,
      [storeId, attributeIds, onlyActive],
    );

    return result.rows;
  }

  async findAttributeById(storeId: string, attributeId: string): Promise<AttributeRecord | null> {
    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        SELECT ${ATTRIBUTE_COLUMNS}
        FROM attributes
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, attributeId],
    );

    return result.rows[0] ?? null;
  }

  async findAttributeBySlug(storeId: string, slug: string): Promise<AttributeRecord | null> {
    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        SELECT ${ATTRIBUTE_COLUMNS}
        FROM attributes
        WHERE store_id = $1
          AND slug = $2
        LIMIT 1
      `,
      [storeId, slug],
    );

    return result.rows[0] ?? null;
  }

  async createAttribute(input: {
    storeId: string;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    type: 'dropdown' | 'color';
    descriptionAr: string | null;
    descriptionEn: string | null;
    isActive: boolean;
    slug: string;
  }): Promise<AttributeRecord> {
    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        INSERT INTO attributes (
          id,
          store_id,
          name,
          name_ar,
          name_en,
          type,
          description_ar,
          description_en,
          is_active,
          slug
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING ${ATTRIBUTE_COLUMNS}
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.type,
        input.descriptionAr,
        input.descriptionEn,
        input.isActive,
        input.slug,
      ],
    );

    return result.rows[0] as AttributeRecord;
  }

  async updateAttribute(input: {
    storeId: string;
    attributeId: string;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    type: 'dropdown' | 'color';
    descriptionAr: string | null;
    descriptionEn: string | null;
    isActive: boolean;
    slug: string;
  }): Promise<AttributeRecord | null> {
    const result = await this.databaseService.db.query<AttributeRecord>(
      `
        UPDATE attributes
        SET name = $3,
            name_ar = $4,
            name_en = $5,
            type = $6,
            description_ar = $7,
            description_en = $8,
            is_active = $9,
            slug = $10,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING ${ATTRIBUTE_COLUMNS}
      `,
      [
        input.storeId,
        input.attributeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.type,
        input.descriptionAr,
        input.descriptionEn,
        input.isActive,
        input.slug,
      ],
    );

    return result.rows[0] ?? null;
  }

  async deleteAttribute(storeId: string, attributeId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM attributes
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, attributeId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listAttributeValues(
    storeId: string,
    attributeId: string,
    q?: string,
    onlyActive = false,
  ): Promise<AttributeValueRecord[]> {
    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        SELECT ${ATTRIBUTE_VALUE_COLUMNS}
        FROM attribute_values
        WHERE store_id = $1
          AND attribute_id = $2
          AND ($3::text IS NULL OR value ILIKE '%' || $3 || '%' OR value_ar ILIKE '%' || $3 || '%' OR value_en ILIKE '%' || $3 || '%' OR slug ILIKE '%' || $3 || '%')
          AND ($4::boolean = FALSE OR is_active = TRUE)
        ORDER BY value ASC
      `,
      [storeId, attributeId, q ?? null, onlyActive],
    );

    return result.rows;
  }

  async listAttributeValuesByAttributeIds(
    storeId: string,
    attributeIds: string[],
    onlyActive = false,
  ): Promise<AttributeValueRecord[]> {
    if (attributeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        SELECT ${ATTRIBUTE_VALUE_COLUMNS}
        FROM attribute_values
        WHERE store_id = $1
          AND attribute_id = ANY($2::uuid[])
          AND ($3::boolean = FALSE OR is_active = TRUE)
        ORDER BY value ASC
      `,
      [storeId, attributeIds, onlyActive],
    );

    return result.rows;
  }

  async findAttributeValueById(
    storeId: string,
    valueId: string,
  ): Promise<AttributeValueRecord | null> {
    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        SELECT ${ATTRIBUTE_VALUE_COLUMNS}
        FROM attribute_values
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, valueId],
    );

    return result.rows[0] ?? null;
  }

  async findAttributeValueBySlug(
    storeId: string,
    attributeId: string,
    slug: string,
  ): Promise<AttributeValueRecord | null> {
    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        SELECT ${ATTRIBUTE_VALUE_COLUMNS}
        FROM attribute_values
        WHERE store_id = $1
          AND attribute_id = $2
          AND slug = $3
        LIMIT 1
      `,
      [storeId, attributeId, slug],
    );

    return result.rows[0] ?? null;
  }

  async createAttributeValue(input: {
    storeId: string;
    attributeId: string;
    value: string;
    valueAr: string | null;
    valueEn: string | null;
    colorHex: string | null;
    isActive: boolean;
    slug: string;
  }): Promise<AttributeValueRecord> {
    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        INSERT INTO attribute_values (
          id,
          store_id,
          attribute_id,
          value,
          value_ar,
          value_en,
          color_hex,
          is_active,
          slug
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING ${ATTRIBUTE_VALUE_COLUMNS}
      `,
      [
        uuidv4(),
        input.storeId,
        input.attributeId,
        input.value,
        input.valueAr,
        input.valueEn,
        input.colorHex,
        input.isActive,
        input.slug,
      ],
    );

    return result.rows[0] as AttributeValueRecord;
  }

  async updateAttributeValue(input: {
    storeId: string;
    valueId: string;
    value: string;
    valueAr: string | null;
    valueEn: string | null;
    colorHex: string | null;
    isActive: boolean;
    slug: string;
  }): Promise<AttributeValueRecord | null> {
    const result = await this.databaseService.db.query<AttributeValueRecord>(
      `
        UPDATE attribute_values
        SET value = $3,
            value_ar = $4,
            value_en = $5,
            color_hex = $6,
            is_active = $7,
            slug = $8,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING ${ATTRIBUTE_VALUE_COLUMNS}
      `,
      [
        input.storeId,
        input.valueId,
        input.value,
        input.valueAr,
        input.valueEn,
        input.colorHex,
        input.isActive,
        input.slug,
      ],
    );

    return result.rows[0] ?? null;
  }

  async deleteAttributeValue(storeId: string, valueId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM attribute_values
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, valueId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listCategoryAttributeIds(storeId: string, categoryId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ attribute_id: string }>(
      `
        SELECT attribute_id
        FROM category_attributes
        WHERE store_id = $1
          AND category_id = $2
        ORDER BY attribute_id ASC
      `,
      [storeId, categoryId],
    );

    return result.rows.map((row) => row.attribute_id);
  }

  async replaceCategoryAttributeIds(
    storeId: string,
    categoryId: string,
    attributeIds: string[],
  ): Promise<void> {
    await this.withTransaction(async (db) => {
      await db.query(
        `
          DELETE FROM category_attributes
          WHERE store_id = $1
            AND category_id = $2
        `,
        [storeId, categoryId],
      );

      for (const attributeId of attributeIds) {
        await db.query(
          `
            INSERT INTO category_attributes (id, store_id, category_id, attribute_id)
            VALUES ($1, $2, $3, $4)
          `,
          [uuidv4(), storeId, categoryId, attributeId],
        );
      }
    });
  }

  async listAttributeValuesByIds(
    storeId: string,
    valueIds: string[],
  ): Promise<AttributeValueWithAttributeRecord[]> {
    if (valueIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<AttributeValueWithAttributeRecord>(
      `
        SELECT
          av.id,
          av.store_id,
          av.attribute_id,
          av.value,
          av.value_ar,
          av.value_en,
          av.color_hex,
          av.is_active,
          av.slug,
          a.name AS attribute_name,
          a.name_ar AS attribute_name_ar,
          a.name_en AS attribute_name_en,
          a.type AS attribute_type,
          a.is_active AS attribute_is_active,
          a.slug AS attribute_slug
        FROM attribute_values av
        INNER JOIN attributes a
          ON a.id = av.attribute_id
         AND a.store_id = av.store_id
        WHERE av.store_id = $1
          AND av.id = ANY($2::uuid[])
      `,
      [storeId, valueIds],
    );

    return result.rows;
  }

  async listVariantAttributeSelections(
    storeId: string,
    variantIds: string[],
  ): Promise<VariantAttributeSelectionRecord[]> {
    if (variantIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<VariantAttributeSelectionRecord>(
      `
        SELECT
          vav.variant_id,
          vav.attribute_id,
          a.slug AS attribute_slug,
          vav.attribute_value_id,
          av.slug AS value_slug
        FROM variant_attribute_values vav
        INNER JOIN attributes a
          ON a.id = vav.attribute_id
         AND a.store_id = vav.store_id
        INNER JOIN attribute_values av
          ON av.id = vav.attribute_value_id
         AND av.store_id = vav.store_id
        WHERE vav.store_id = $1
          AND vav.variant_id = ANY($2::uuid[])
      `,
      [storeId, variantIds],
    );

    return result.rows;
  }

  async replaceVariantAttributeValues(
    storeId: string,
    variantId: string,
    assignments: Array<{ attributeId: string; attributeValueId: string }>,
  ): Promise<void> {
    await this.withTransaction(async (db) => {
      await db.query(
        `
          DELETE FROM variant_attribute_values
          WHERE store_id = $1
            AND variant_id = $2
        `,
        [storeId, variantId],
      );

      for (const assignment of assignments) {
        await db.query(
          `
            INSERT INTO variant_attribute_values (
              id,
              store_id,
              variant_id,
              attribute_id,
              attribute_value_id
            ) VALUES ($1, $2, $3, $4, $5)
          `,
          [uuidv4(), storeId, variantId, assignment.attributeId, assignment.attributeValueId],
        );
      }
    });
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
