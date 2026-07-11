import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface BrandRecord {
  id: string;
  store_id: string;
  name: string;
  name_ar: string;
  name_en: string | null;
  media_asset_id: string | null;
  image_url: string | null;
  is_active: boolean;
  is_popular: boolean;
}

export interface MediaAssetRecord {
  id: string;
  store_id: string;
  public_url: string;
  mime_type: string;
  file_size_bytes: number;
}

const BRAND_COLUMNS = `b.id, b.store_id, b.name, b.name_ar, b.name_en, b.media_asset_id, ma.public_url AS image_url, b.is_active, b.is_popular`;

@Injectable()
export class BrandsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(storeId: string, brandId: string): Promise<BrandRecord | null> {
    const result = await this.databaseService.db.query<BrandRecord>(
      `
        SELECT ${BRAND_COLUMNS}
        FROM brands b
        LEFT JOIN media_assets ma ON ma.id = b.media_asset_id
        WHERE b.store_id = $1
          AND b.id = $2
        LIMIT 1
      `,
      [storeId, brandId],
    );

    return result.rows[0] ?? null;
  }

  async findByNameAr(storeId: string, nameAr: string): Promise<BrandRecord | null> {
    const result = await this.databaseService.db.query<BrandRecord>(
      `
        SELECT ${BRAND_COLUMNS}
        FROM brands b
        LEFT JOIN media_assets ma ON ma.id = b.media_asset_id
        WHERE b.store_id = $1
          AND LOWER(b.name_ar) = LOWER($2)
        LIMIT 1
      `,
      [storeId, nameAr],
    );

    return result.rows[0] ?? null;
  }

  async create(input: {
    id: string;
    storeId: string;
    name: string;
    nameAr: string;
    nameEn: string | null;
    mediaAssetId: string | null;
    isActive: boolean;
    isPopular: boolean;
  }): Promise<BrandRecord> {
    await this.databaseService.db.query(
      `
        INSERT INTO brands (id, store_id, name, name_ar, name_en, media_asset_id, is_active, is_popular)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        input.id,
        input.storeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.mediaAssetId,
        input.isActive,
        input.isPopular,
      ],
    );

    return this.findById(input.storeId, input.id) as Promise<BrandRecord>;
  }

  async list(input: { storeId: string; q?: string; isActive?: boolean }): Promise<BrandRecord[]> {
    const result = await this.databaseService.db.query<BrandRecord>(
      `
        SELECT ${BRAND_COLUMNS}
        FROM brands b
        LEFT JOIN media_assets ma ON ma.id = b.media_asset_id
        WHERE b.store_id = $1
          AND ($2::text IS NULL OR b.name ILIKE '%' || $2 || '%' OR b.name_ar ILIKE '%' || $2 || '%' OR b.name_en ILIKE '%' || $2 || '%')
          AND ($3::boolean IS NULL OR b.is_active = $3)
        ORDER BY b.is_popular DESC, b.name_ar ASC, b.created_at DESC
      `,
      [input.storeId, input.q ?? null, input.isActive ?? null],
    );

    return result.rows;
  }

  async update(input: {
    storeId: string;
    brandId: string;
    name: string;
    nameAr: string;
    nameEn: string | null;
    mediaAssetId: string | null;
    isActive: boolean;
    isPopular: boolean;
  }): Promise<BrandRecord | null> {
    await this.databaseService.db.query(
      `
        UPDATE brands
        SET name = $3,
            name_ar = $4,
            name_en = $5,
            media_asset_id = $6,
            is_active = $7,
            is_popular = $8,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
      `,
      [
        input.storeId,
        input.brandId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.mediaAssetId,
        input.isActive,
        input.isPopular,
      ],
    );

    return this.findById(input.storeId, input.brandId);
  }

  async delete(storeId: string, brandId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM brands
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, brandId],
    );

    return (result.rowCount ?? 0) > 0;
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
