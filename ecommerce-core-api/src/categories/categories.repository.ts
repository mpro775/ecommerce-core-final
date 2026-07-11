import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface CategoryRecord {
  id: string;
  store_id: string;
  parent_id: string | null;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  slug: string;
  description: string | null;
  description_ar: string | null;
  description_en: string | null;
  media_asset_id: string | null;
  image_url: string | null;
  image_alt_ar: string | null;
  image_alt_en: string | null;
  background_media_asset_id: string | null;
  background_image_url: string | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MediaAssetRecord {
  id: string;
  store_id: string;
  public_url: string;
  mime_type: string;
  file_size_bytes: number;
}

const CATEGORY_COLUMNS = `c.id, c.store_id, c.parent_id, c.name, c.name_ar, c.name_en, c.slug, c.description, c.description_ar, c.description_en, c.media_asset_id, ma.public_url AS image_url, c.image_alt_ar, c.image_alt_en, c.background_media_asset_id, bma.public_url AS background_image_url, c.seo_title_ar, c.seo_title_en, c.seo_description_ar, c.seo_description_en, c.sort_order, c.is_active`;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(storeId: string, categoryId: string): Promise<CategoryRecord | null> {
    const result = await this.databaseService.db.query<CategoryRecord>(
      `
        SELECT ${CATEGORY_COLUMNS}
        FROM categories c
        LEFT JOIN media_assets ma ON ma.id = c.media_asset_id
        LEFT JOIN media_assets bma ON bma.id = c.background_media_asset_id
        WHERE c.store_id = $1
          AND c.id = $2
        LIMIT 1
      `,
      [storeId, categoryId],
    );
    return result.rows[0] ?? null;
  }

  async findBySlug(storeId: string, slug: string): Promise<CategoryRecord | null> {
    const result = await this.databaseService.db.query<CategoryRecord>(
      `
        SELECT ${CATEGORY_COLUMNS}
        FROM categories c
        LEFT JOIN media_assets ma ON ma.id = c.media_asset_id
        LEFT JOIN media_assets bma ON bma.id = c.background_media_asset_id
        WHERE c.store_id = $1
          AND c.slug = $2
        LIMIT 1
      `,
      [storeId, slug],
    );
    return result.rows[0] ?? null;
  }

  async create(input: {
    id: string;
    storeId: string;
    parentId: string | null;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    mediaAssetId: string | null;
    imageAltAr: string | null;
    imageAltEn: string | null;
    backgroundMediaAssetId: string | null;
    seoTitleAr: string | null;
    seoTitleEn: string | null;
    seoDescriptionAr: string | null;
    seoDescriptionEn: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<CategoryRecord> {
    const result = await this.databaseService.db.query<CategoryRecord>(
      `
        INSERT INTO categories (
          id, store_id, parent_id, name, name_ar, name_en, slug, description, description_ar, description_en, media_asset_id, image_alt_ar, image_alt_en, background_media_asset_id, seo_title_ar, seo_title_en, seo_description_ar, seo_description_en, sort_order, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
      `,
      [
        input.id,
        input.storeId,
        input.parentId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.slug,
        input.description,
        input.descriptionAr,
        input.descriptionEn,
        input.mediaAssetId,
        input.imageAltAr,
        input.imageAltEn,
        input.backgroundMediaAssetId,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        input.sortOrder,
        input.isActive,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create category');
    }
    return this.findById(input.storeId, row.id) as Promise<CategoryRecord>;
  }

  async list(
    storeId: string,
    filters: { q?: string | undefined; parentId?: string | undefined },
  ): Promise<CategoryRecord[]> {
    const result = await this.databaseService.db.query<CategoryRecord>(
      `
        SELECT ${CATEGORY_COLUMNS}
        FROM categories c
        LEFT JOIN media_assets ma ON ma.id = c.media_asset_id
        LEFT JOIN media_assets bma ON bma.id = c.background_media_asset_id
        WHERE c.store_id = $1
          AND ($2::text IS NULL OR c.parent_id = $2::uuid)
          AND ($3::text IS NULL OR c.name ILIKE '%' || $3 || '%' OR c.name_ar ILIKE '%' || $3 || '%' OR c.name_en ILIKE '%' || $3 || '%' OR c.slug ILIKE '%' || $3 || '%')
        ORDER BY c.sort_order ASC, c.created_at DESC
      `,
      [storeId, filters.parentId ?? null, filters.q ?? null],
    );

    return result.rows;
  }

  async listActive(storeId: string): Promise<CategoryRecord[]> {
    const result = await this.databaseService.db.query<CategoryRecord>(
      `
        SELECT ${CATEGORY_COLUMNS}
        FROM categories c
        LEFT JOIN media_assets ma ON ma.id = c.media_asset_id
        LEFT JOIN media_assets bma ON bma.id = c.background_media_asset_id
        WHERE c.store_id = $1
          AND c.is_active = TRUE
        ORDER BY c.sort_order ASC, c.created_at DESC
      `,
      [storeId],
    );

    return result.rows;
  }

  async update(input: {
    storeId: string;
    categoryId: string;
    parentId: string | null;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    mediaAssetId: string | null;
    imageAltAr: string | null;
    imageAltEn: string | null;
    backgroundMediaAssetId: string | null;
    seoTitleAr: string | null;
    seoTitleEn: string | null;
    seoDescriptionAr: string | null;
    seoDescriptionEn: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<CategoryRecord | null> {
    await this.databaseService.db.query(
      `
        UPDATE categories
        SET parent_id = $3,
            name = $4,
            name_ar = $5,
            name_en = $6,
            slug = $7,
            description = $8,
            description_ar = $9,
            description_en = $10,
            media_asset_id = $11,
            image_alt_ar = $12,
            image_alt_en = $13,
            background_media_asset_id = $14,
            seo_title_ar = $15,
            seo_title_en = $16,
            seo_description_ar = $17,
            seo_description_en = $18,
            sort_order = $19,
            is_active = $20,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
      `,
      [
        input.storeId,
        input.categoryId,
        input.parentId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.slug,
        input.description,
        input.descriptionAr,
        input.descriptionEn,
        input.mediaAssetId,
        input.imageAltAr,
        input.imageAltEn,
        input.backgroundMediaAssetId,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        input.sortOrder,
        input.isActive,
      ],
    );

    return this.findById(input.storeId, input.categoryId);
  }

  async delete(storeId: string, categoryId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM categories
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, categoryId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async hasChildren(storeId: string, categoryId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM categories
          WHERE store_id = $1
            AND parent_id = $2
        ) AS exists
      `,
      [storeId, categoryId],
    );

    return Boolean(result.rows[0]?.exists);
  }

  async hasProducts(storeId: string, categoryId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1
          FROM products
          WHERE store_id = $1
            AND category_id = $2
        ) AS exists
      `,
      [storeId, categoryId],
    );

    return Boolean(result.rows[0]?.exists);
  }

  async findMediaAssetById(
    storeId: string,
    mediaAssetId: string,
  ): Promise<MediaAssetRecord | null> {
    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        SELECT id, store_id, public_url, mime_type, file_size_bytes
        FROM media_assets
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, mediaAssetId],
    );
    return result.rows[0] ?? null;
  }
}
