import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { ProductStatus } from './constants/product-status.constants';
import type { ProductType } from './constants/product-type.constants';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface ProductRecord {
  id: string;
  store_id: string;
  category_id: string | null;
  product_type: ProductType;
  is_visible: boolean;
  stock_unlimited: boolean;
  questions_enabled: boolean;
  title: string;
  title_ar: string | null;
  title_en: string | null;
  slug: string;
  description: string | null;
  description_ar: string | null;
  description_en: string | null;
  short_description_ar: string | null;
  short_description_en: string | null;
  detailed_description_ar: string | null;
  detailed_description_en: string | null;
  status: ProductStatus;
  brand: string | null;
  brand_id: string | null;
  weight: string | null;
  weight_unit: string | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  cost_price: string | null;
  product_label: string | null;
  youtube_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  custom_fields: Array<Record<string, unknown>>;
  inline_discount_type: 'percent' | 'fixed' | null;
  inline_discount_value: string | null;
  inline_discount_starts_at: string | null;
  inline_discount_ends_at: string | null;
  inline_discount_active: boolean;
  digital_download_attempts_limit: number | null;
  digital_download_expires_at: string | null;
  tags: string[];
  is_featured: boolean;
  is_taxable: boolean;
  tax_rate: string;
  min_order_quantity: number;
  max_order_quantity: number | null;
  published_at: string | null;
  rating_avg: string;
  rating_count: number;
}

export interface ProductVariantRecord {
  id: string;
  product_id: string;
  store_id: string;
  title: string;
  title_ar: string | null;
  title_en: string | null;
  sku: string;
  barcode: string | null;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  attributes: Record<string, string>;
  is_default: boolean;
}

export interface ProductImageRecord {
  id: string;
  product_id: string;
  variant_id: string | null;
  media_asset_id: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductBundleItemRecord {
  id: string;
  bundle_product_id: string;
  bundled_product_id: string;
  bundled_variant_id: string | null;
  quantity: number;
  sort_order: number;
  bundled_product_title: string;
  bundled_variant_title: string | null;
}

export interface ProductDigitalFileRecord {
  id: string;
  product_id: string;
  media_asset_id: string;
  file_name: string | null;
  sort_order: number;
  public_url: string;
  file_size_bytes: number;
}

export interface MediaAssetRecord {
  id: string;
  store_id: string;
  public_url: string;
  mime_type: string;
  file_size_bytes: number;
}

const PRODUCT_COLUMNS = `id, store_id, category_id, product_type, is_visible, stock_unlimited, questions_enabled, title, title_ar, title_en, slug, description, description_ar, description_en, short_description_ar, short_description_en, detailed_description_ar, detailed_description_en, status, brand, brand_id, weight, weight_unit, dimensions, cost_price, product_label, youtube_url, seo_title, seo_description, seo_title_ar, seo_title_en, seo_description_ar, seo_description_en, custom_fields, inline_discount_type, inline_discount_value, inline_discount_starts_at, inline_discount_ends_at, inline_discount_active, digital_download_attempts_limit, digital_download_expires_at, tags, is_featured, is_taxable, tax_rate, min_order_quantity, max_order_quantity, published_at, rating_avg, rating_count`;

export interface ProductListAttributeFilter {
  attributeSlug: string;
  valueSlugs: string[];
}

export interface ProductListFilterValueFilter {
  filterSlug: string;
  valueSlugs: string[];
}

export interface ProductListFilterRangeFilter {
  filterSlug: string;
  min?: number;
  max?: number;
}

@Injectable()
export class ProductsRepository {
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

  async findById(storeId: string, productId: string): Promise<ProductRecord | null> {
    const result = await this.databaseService.db.query<ProductRecord>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM products
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, productId],
    );
    return result.rows[0] ?? null;
  }

  async findBySlug(storeId: string, slug: string): Promise<ProductRecord | null> {
    const result = await this.databaseService.db.query<ProductRecord>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM products
        WHERE store_id = $1
          AND slug = $2
        LIMIT 1
      `,
      [storeId, slug],
    );
    return result.rows[0] ?? null;
  }

  async create(input: {
    id: string;
    storeId: string;
    categoryId: string | null;
    productType: ProductType;
    isVisible: boolean;
    stockUnlimited: boolean;
    questionsEnabled: boolean;
    title: string;
    titleAr: string | null;
    titleEn: string | null;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    shortDescriptionAr: string | null;
    shortDescriptionEn: string | null;
    detailedDescriptionAr: string | null;
    detailedDescriptionEn: string | null;
    status: ProductStatus;
    brand: string | null;
    brandId: string | null;
    weight: number | null;
    weightUnit: string | null;
    dimensions: { length?: number; width?: number; height?: number } | null;
    costPrice: number | null;
    productLabel: string | null;
    youtubeUrl: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoTitleAr: string | null;
    seoTitleEn: string | null;
    seoDescriptionAr: string | null;
    seoDescriptionEn: string | null;
    customFields: Array<Record<string, unknown>>;
    inlineDiscountType: 'percent' | 'fixed' | null;
    inlineDiscountValue: number | null;
    inlineDiscountStartsAt: Date | null;
    inlineDiscountEndsAt: Date | null;
    inlineDiscountActive: boolean;
    digitalDownloadAttemptsLimit: number | null;
    digitalDownloadExpiresAt: Date | null;
    tags: string[];
    isFeatured: boolean;
    isTaxable: boolean;
    taxRate: number;
    minOrderQuantity: number;
    maxOrderQuantity: number | null;
  }): Promise<ProductRecord> {
    const result = await this.databaseService.db.query<ProductRecord>(
      `
        INSERT INTO products (
          id,
          store_id,
          category_id,
          product_type,
          is_visible,
          stock_unlimited,
          title,
          title_ar,
          title_en,
          slug,
          description,
          description_ar,
          description_en,
          short_description_ar,
          short_description_en,
          detailed_description_ar,
          detailed_description_en,
          status,
          brand,
          weight,
          weight_unit,
          dimensions,
          cost_price,
          product_label,
          youtube_url,
          seo_title,
          seo_description,
          seo_title_ar,
          seo_title_en,
          seo_description_ar,
          seo_description_en,
          custom_fields,
          inline_discount_type,
          inline_discount_value,
          inline_discount_starts_at,
          inline_discount_ends_at,
          inline_discount_active,
          digital_download_attempts_limit,
          digital_download_expires_at,
          tags,
          is_featured,
          is_taxable,
          tax_rate,
          min_order_quantity,
          max_order_quantity,
          questions_enabled,
          brand_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22::jsonb, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32::jsonb, $33, $34, $35, $36, $37, $38, $39, $40,
          $41, $42, $43, $44, $45, $46, $47
        )
        RETURNING ${PRODUCT_COLUMNS}
      `,
      [
        input.id,
        input.storeId,
        input.categoryId,
        input.productType,
        input.isVisible,
        input.stockUnlimited,
        input.title,
        input.titleAr,
        input.titleEn,
        input.slug,
        input.description,
        input.descriptionAr,
        input.descriptionEn,
        input.shortDescriptionAr,
        input.shortDescriptionEn,
        input.detailedDescriptionAr,
        input.detailedDescriptionEn,
        input.status,
        input.brand,
        input.weight,
        input.weightUnit,
        input.dimensions ? JSON.stringify(input.dimensions) : null,
        input.costPrice,
        input.productLabel,
        input.youtubeUrl,
        input.seoTitle,
        input.seoDescription,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        JSON.stringify(input.customFields),
        input.inlineDiscountType,
        input.inlineDiscountValue,
        input.inlineDiscountStartsAt,
        input.inlineDiscountEndsAt,
        input.inlineDiscountActive,
        input.digitalDownloadAttemptsLimit,
        input.digitalDownloadExpiresAt,
        input.tags,
        input.isFeatured,
        input.isTaxable,
        input.taxRate,
        input.minOrderQuantity,
        input.maxOrderQuantity,
        input.questionsEnabled,
        input.brandId,
      ],
    );
    return result.rows[0] as ProductRecord;
  }

  async list(input: {
    storeId: string;
    q?: string | undefined;
    status?: ProductStatus | undefined;
    categoryId?: string | undefined;
    productType?: ProductType | undefined;
    isVisible?: boolean | undefined;
    isFeatured?: boolean | undefined;
    brand?: string | undefined;
    attributeFilters?: ProductListAttributeFilter[] | undefined;
    filterValueFilters?: ProductListFilterValueFilter[] | undefined;
    filterRangeFilters?: ProductListFilterRangeFilter[] | undefined;
    brandFilter?: string[] | undefined;
    warehouseFilter?: string[] | undefined;
    inStockOnly?: boolean;
    priceMin?: number | undefined;
    priceMax?: number | undefined;
    limit: number;
    offset: number;
  }): Promise<{ rows: ProductRecord[]; total: number }> {
    const listQuery = this.buildListQuery(input);

    const rowsResult = await this.databaseService.db.query<ProductRecord>(
      `
        SELECT ${PRODUCT_COLUMNS}
        FROM products p
        WHERE ${listQuery.whereClause}
        ORDER BY created_at DESC
        LIMIT $${listQuery.nextParam}::int OFFSET $${listQuery.nextParam + 1}::int
      `,
      [...listQuery.values, Number(input.limit), Number(input.offset)],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM products p
        WHERE ${listQuery.whereClause}
      `,
      listQuery.values,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async updateVariantAttributes(input: {
    storeId: string;
    variantId: string;
    attributes: Record<string, string>;
  }): Promise<ProductVariantRecord | null> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        UPDATE product_variants
        SET attributes = $3::jsonb,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
      `,
      [input.storeId, input.variantId, JSON.stringify(input.attributes)],
    );

    return result.rows[0] ?? null;
  }

  async update(input: {
    storeId: string;
    productId: string;
    categoryId: string | null;
    productType: ProductType;
    isVisible: boolean;
    stockUnlimited: boolean;
    questionsEnabled: boolean;
    title: string;
    titleAr: string | null;
    titleEn: string | null;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    shortDescriptionAr: string | null;
    shortDescriptionEn: string | null;
    detailedDescriptionAr: string | null;
    detailedDescriptionEn: string | null;
    status: ProductStatus;
    brand: string | null;
    brandId: string | null;
    weight: number | null;
    weightUnit: string | null;
    dimensions: { length?: number; width?: number; height?: number } | null;
    costPrice: number | null;
    productLabel: string | null;
    youtubeUrl: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoTitleAr: string | null;
    seoTitleEn: string | null;
    seoDescriptionAr: string | null;
    seoDescriptionEn: string | null;
    customFields: Array<Record<string, unknown>>;
    inlineDiscountType: 'percent' | 'fixed' | null;
    inlineDiscountValue: number | null;
    inlineDiscountStartsAt: Date | null;
    inlineDiscountEndsAt: Date | null;
    inlineDiscountActive: boolean;
    digitalDownloadAttemptsLimit: number | null;
    digitalDownloadExpiresAt: Date | null;
    tags: string[];
    isFeatured: boolean;
    isTaxable: boolean;
    taxRate: number;
    minOrderQuantity: number;
    maxOrderQuantity: number | null;
  }): Promise<ProductRecord | null> {
    const result = await this.databaseService.db.query<ProductRecord>(
      `
        UPDATE products
        SET category_id = $3,
            product_type = $4,
            is_visible = $5,
            stock_unlimited = $6,
            title = $7,
            title_ar = $8,
            title_en = $9,
            slug = $10,
            description = $11,
            description_ar = $12,
            description_en = $13,
            short_description_ar = $14,
            short_description_en = $15,
            detailed_description_ar = $16,
            detailed_description_en = $17,
            status = $18,
            brand = $19,
            weight = $20,
            weight_unit = $21,
            dimensions = $22::jsonb,
            cost_price = $23,
            product_label = $24,
            youtube_url = $25,
            seo_title = $26,
            seo_description = $27,
            seo_title_ar = $28,
            seo_title_en = $29,
            seo_description_ar = $30,
            seo_description_en = $31,
            custom_fields = $32::jsonb,
            inline_discount_type = $33,
            inline_discount_value = $34,
            inline_discount_starts_at = $35,
            inline_discount_ends_at = $36,
            inline_discount_active = $37,
            digital_download_attempts_limit = $38,
            digital_download_expires_at = $39,
            tags = $40,
            is_featured = $41,
            is_taxable = $42,
            tax_rate = $43,
            min_order_quantity = $44,
            max_order_quantity = $45,
            questions_enabled = $46,
            brand_id = $47,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING ${PRODUCT_COLUMNS}
      `,
      [
        input.storeId,
        input.productId,
        input.categoryId,
        input.productType,
        input.isVisible,
        input.stockUnlimited,
        input.title,
        input.titleAr,
        input.titleEn,
        input.slug,
        input.description,
        input.descriptionAr,
        input.descriptionEn,
        input.shortDescriptionAr,
        input.shortDescriptionEn,
        input.detailedDescriptionAr,
        input.detailedDescriptionEn,
        input.status,
        input.brand,
        input.weight,
        input.weightUnit,
        input.dimensions ? JSON.stringify(input.dimensions) : null,
        input.costPrice,
        input.productLabel,
        input.youtubeUrl,
        input.seoTitle,
        input.seoDescription,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        JSON.stringify(input.customFields),
        input.inlineDiscountType,
        input.inlineDiscountValue,
        input.inlineDiscountStartsAt,
        input.inlineDiscountEndsAt,
        input.inlineDiscountActive,
        input.digitalDownloadAttemptsLimit,
        input.digitalDownloadExpiresAt,
        input.tags,
        input.isFeatured,
        input.isTaxable,
        input.taxRate,
        input.minOrderQuantity,
        input.maxOrderQuantity,
        input.questionsEnabled,
        input.brandId,
      ],
    );

    return result.rows[0] ?? null;
  }

  async delete(storeId: string, productId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM products
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, productId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createVariant(input: {
    id?: string;
    productId: string;
    storeId: string;
    title: string;
    titleAr: string | null;
    titleEn: string | null;
    sku: string;
    barcode: string | null;
    price: number;
    compareAtPrice: number | null;
    stockQuantity: number;
    lowStockThreshold: number;
    attributes: Record<string, string>;
    isDefault: boolean;
  }): Promise<ProductVariantRecord> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        INSERT INTO product_variants (
          id,
          product_id,
          store_id,
          title,
          title_ar,
          title_en,
          sku,
          barcode,
          price,
          compare_at_price,
          stock_quantity,
          low_stock_threshold,
          attributes,
          is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
        RETURNING id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
      `,
      [
        input.id ?? uuidv4(),
        input.productId,
        input.storeId,
        input.title,
        input.titleAr,
        input.titleEn,
        input.sku,
        input.barcode,
        input.price,
        input.compareAtPrice,
        input.stockQuantity,
        input.lowStockThreshold,
        JSON.stringify(input.attributes),
        input.isDefault,
      ],
    );

    return result.rows[0] as ProductVariantRecord;
  }

  async unsetDefaultVariants(
    storeId: string,
    productId: string,
    exceptVariantId: string,
  ): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE product_variants
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE store_id = $1
          AND product_id = $2
          AND id <> $3
      `,
      [storeId, productId, exceptVariantId],
    );
  }

  async listVariants(storeId: string, productId: string): Promise<ProductVariantRecord[]> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        SELECT id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
        FROM product_variants
        WHERE store_id = $1
          AND product_id = $2
        ORDER BY is_default DESC, created_at ASC
      `,
      [storeId, productId],
    );
    return result.rows;
  }

  async findVariantById(storeId: string, variantId: string): Promise<ProductVariantRecord | null> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        SELECT id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
        FROM product_variants
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, variantId],
    );
    return result.rows[0] ?? null;
  }

  async findVariantBySku(storeId: string, sku: string): Promise<ProductVariantRecord | null> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        SELECT id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
        FROM product_variants
        WHERE store_id = $1
          AND LOWER(sku) = LOWER($2)
        LIMIT 1
      `,
      [storeId, sku],
    );
    return result.rows[0] ?? null;
  }

  async updateVariant(input: {
    storeId: string;
    variantId: string;
    title?: string;
    titleAr?: string | null;
    titleEn?: string | null;
    sku?: string;
    barcode?: string | null;
    price?: number;
    compareAtPrice?: number | null;
    stockQuantity?: number;
    lowStockThreshold?: number;
    isDefault?: boolean;
  }): Promise<ProductVariantRecord | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      sets.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.titleAr !== undefined) {
      sets.push(`title_ar = $${paramIndex++}`);
      values.push(input.titleAr);
    }
    if (input.titleEn !== undefined) {
      sets.push(`title_en = $${paramIndex++}`);
      values.push(input.titleEn);
    }
    if (input.sku !== undefined) {
      sets.push(`sku = $${paramIndex++}`);
      values.push(input.sku);
    }
    if (input.barcode !== undefined) {
      sets.push(`barcode = $${paramIndex++}`);
      values.push(input.barcode);
    }
    if (input.price !== undefined) {
      sets.push(`price = $${paramIndex++}`);
      values.push(input.price);
    }
    if (input.compareAtPrice !== undefined) {
      sets.push(`compare_at_price = $${paramIndex++}`);
      values.push(input.compareAtPrice);
    }
    if (input.stockQuantity !== undefined) {
      sets.push(`stock_quantity = $${paramIndex++}`);
      values.push(input.stockQuantity);
    }
    if (input.lowStockThreshold !== undefined) {
      sets.push(`low_stock_threshold = $${paramIndex++}`);
      values.push(input.lowStockThreshold);
    }
    if (input.isDefault !== undefined) {
      sets.push(`is_default = $${paramIndex++}`);
      values.push(input.isDefault);
    }

    if (sets.length === 0) return this.findVariantById(input.storeId, input.variantId);

    sets.push(`updated_at = NOW()`);
    values.push(input.storeId, input.variantId);

    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        UPDATE product_variants
        SET ${sets.join(', ')}
        WHERE store_id = $${paramIndex++}
          AND id = $${paramIndex++}
        RETURNING id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deleteVariant(storeId: string, variantId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM product_variants
        WHERE store_id = $1
          AND id = $2
      `,
      [storeId, variantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countVariants(storeId: string, productId: string): Promise<number> {
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

  async attachImage(input: {
    storeId: string;
    productId: string;
    variantId: string | null;
    mediaAssetId: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }): Promise<ProductImageRecord> {
    if (input.isPrimary) {
      await this.clearPrimaryImage(input.storeId, input.productId);
    }

    const result = await this.databaseService.db.query<ProductImageRecord>(
      `
        INSERT INTO product_images (
          id,
          store_id,
          product_id,
          variant_id,
          media_asset_id,
          alt_text,
          sort_order,
          is_primary
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, product_id, variant_id, media_asset_id, alt_text, sort_order, is_primary,
          (SELECT public_url FROM media_assets WHERE id = $5) AS public_url
      `,
      [
        uuidv4(),
        input.storeId,
        input.productId,
        input.variantId,
        input.mediaAssetId,
        input.altText,
        input.sortOrder,
        input.isPrimary,
      ],
    );
    return result.rows[0] as ProductImageRecord;
  }

  async listProductImages(storeId: string, productId: string): Promise<ProductImageRecord[]> {
    const result = await this.databaseService.db.query<ProductImageRecord>(
      `
        SELECT
          pi.id,
          pi.product_id,
          pi.variant_id,
          pi.media_asset_id,
          ma.public_url,
          pi.alt_text,
          pi.sort_order,
          pi.is_primary
        FROM product_images pi
        INNER JOIN media_assets ma ON ma.id = pi.media_asset_id
        WHERE pi.store_id = $1
          AND pi.product_id = $2
        ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
      `,
      [storeId, productId],
    );
    return result.rows;
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

  async countProductImages(storeId: string, productId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM product_images
        WHERE store_id = $1
          AND product_id = $2
      `,
      [storeId, productId],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async clearPrimaryImage(storeId: string, productId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE product_images
        SET is_primary = FALSE,
            updated_at = NOW()
        WHERE store_id = $1
          AND product_id = $2
          AND is_primary = TRUE
      `,
      [storeId, productId],
    );
  }

  async reorderProductImages(input: {
    storeId: string;
    productId: string;
    imageIds: string[];
    primaryImageId: string;
  }): Promise<void> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          UPDATE product_images
          SET is_primary = FALSE,
              updated_at = NOW()
          WHERE store_id = $1
            AND product_id = $2
        `,
        [input.storeId, input.productId],
      );

      for (const [index, imageId] of input.imageIds.entries()) {
        await client.query(
          `
            UPDATE product_images
            SET sort_order = $1,
                is_primary = $2,
                updated_at = NOW()
            WHERE store_id = $3
              AND product_id = $4
              AND id = $5
          `,
          [index, imageId === input.primaryImageId, input.storeId, input.productId, imageId],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProductImage(input: {
    storeId: string;
    productId: string;
    imageId: string;
  }): Promise<boolean> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const deleted = await client.query<{ is_primary: boolean }>(
        `
          DELETE FROM product_images
          WHERE store_id = $1
            AND product_id = $2
            AND id = $3
          RETURNING is_primary
        `,
        [input.storeId, input.productId, input.imageId],
      );

      if ((deleted.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      if (deleted.rows[0]?.is_primary) {
        await client.query(
          `
            UPDATE product_images
            SET is_primary = TRUE,
                updated_at = NOW()
            WHERE id = (
              SELECT id
              FROM product_images
              WHERE store_id = $1
                AND product_id = $2
              ORDER BY sort_order ASC, created_at ASC
              LIMIT 1
            )
          `,
          [input.storeId, input.productId],
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listProductCategoryIds(storeId: string, productId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ category_id: string }>(
      `
        SELECT category_id
        FROM product_categories
        WHERE store_id = $1
          AND product_id = $2
        ORDER BY created_at ASC
      `,
      [storeId, productId],
    );
    return result.rows.map((row) => row.category_id);
  }

  async replaceProductCategories(
    db: Queryable,
    input: { storeId: string; productId: string; categoryIds: string[] },
  ): Promise<void> {
    await db.query(`DELETE FROM product_categories WHERE store_id = $1 AND product_id = $2`, [
      input.storeId,
      input.productId,
    ]);

    for (const categoryId of input.categoryIds) {
      await db.query(
        `
          INSERT INTO product_categories (id, store_id, product_id, category_id)
          VALUES ($1, $2, $3, $4)
        `,
        [uuidv4(), input.storeId, input.productId, categoryId],
      );
    }
  }

  async listRelatedProductIds(storeId: string, productId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ related_product_id: string }>(
      `
        SELECT related_product_id
        FROM product_related_products
        WHERE store_id = $1
          AND product_id = $2
        ORDER BY created_at ASC
      `,
      [storeId, productId],
    );
    return result.rows.map((row) => row.related_product_id);
  }

  async replaceRelatedProducts(
    db: Queryable,
    input: { storeId: string; productId: string; relatedProductIds: string[] },
  ): Promise<void> {
    await db.query(`DELETE FROM product_related_products WHERE store_id = $1 AND product_id = $2`, [
      input.storeId,
      input.productId,
    ]);

    for (const relatedProductId of input.relatedProductIds) {
      await db.query(
        `
          INSERT INTO product_related_products (id, store_id, product_id, related_product_id)
          VALUES ($1, $2, $3, $4)
        `,
        [uuidv4(), input.storeId, input.productId, relatedProductId],
      );
    }
  }

  async listBundleItems(storeId: string, productId: string): Promise<ProductBundleItemRecord[]> {
    const result = await this.databaseService.db.query<ProductBundleItemRecord>(
      `
        SELECT
          pbi.id,
          pbi.bundle_product_id,
          pbi.bundled_product_id,
          pbi.bundled_variant_id,
          pbi.quantity,
          pbi.sort_order,
          bp.title AS bundled_product_title,
          bv.title AS bundled_variant_title
        FROM product_bundle_items pbi
        INNER JOIN products bp ON bp.id = pbi.bundled_product_id
        LEFT JOIN product_variants bv ON bv.id = pbi.bundled_variant_id
        WHERE pbi.store_id = $1
          AND pbi.bundle_product_id = $2
        ORDER BY pbi.sort_order ASC, pbi.created_at ASC
      `,
      [storeId, productId],
    );

    return result.rows;
  }

  async replaceBundleItems(
    db: Queryable,
    input: {
      storeId: string;
      productId: string;
      bundleItems: Array<{
        bundledProductId: string;
        bundledVariantId: string | null;
        quantity: number;
        sortOrder: number;
      }>;
    },
  ): Promise<void> {
    await db.query(
      `DELETE FROM product_bundle_items WHERE store_id = $1 AND bundle_product_id = $2`,
      [input.storeId, input.productId],
    );

    for (const item of input.bundleItems) {
      await db.query(
        `
          INSERT INTO product_bundle_items (
            id,
            store_id,
            bundle_product_id,
            bundled_product_id,
            bundled_variant_id,
            quantity,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          uuidv4(),
          input.storeId,
          input.productId,
          item.bundledProductId,
          item.bundledVariantId,
          item.quantity,
          item.sortOrder,
        ],
      );
    }
  }

  async listDigitalFiles(storeId: string, productId: string): Promise<ProductDigitalFileRecord[]> {
    const result = await this.databaseService.db.query<ProductDigitalFileRecord>(
      `
        SELECT
          pdf.id,
          pdf.product_id,
          pdf.media_asset_id,
          pdf.file_name,
          pdf.sort_order,
          ma.public_url,
          ma.file_size_bytes
        FROM product_digital_files pdf
        INNER JOIN media_assets ma ON ma.id = pdf.media_asset_id
        WHERE pdf.store_id = $1
          AND pdf.product_id = $2
        ORDER BY pdf.sort_order ASC, pdf.created_at ASC
      `,
      [storeId, productId],
    );

    return result.rows;
  }

  async replaceDigitalFiles(
    db: Queryable,
    input: {
      storeId: string;
      productId: string;
      files: Array<{ mediaAssetId: string; fileName: string | null; sortOrder: number }>;
    },
  ): Promise<void> {
    await db.query(`DELETE FROM product_digital_files WHERE store_id = $1 AND product_id = $2`, [
      input.storeId,
      input.productId,
    ]);

    for (const file of input.files) {
      await db.query(
        `
          INSERT INTO product_digital_files (
            id,
            store_id,
            product_id,
            media_asset_id,
            file_name,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          uuidv4(),
          input.storeId,
          input.productId,
          file.mediaAssetId,
          file.fileName,
          file.sortOrder,
        ],
      );
    }
  }

  async listMediaAssetsByIds(
    storeId: string,
    mediaAssetIds: string[],
  ): Promise<MediaAssetRecord[]> {
    if (mediaAssetIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        SELECT id, store_id, public_url, mime_type, file_size_bytes
        FROM media_assets
        WHERE store_id = $1
          AND id = ANY($2::uuid[])
      `,
      [storeId, mediaAssetIds],
    );
    return result.rows;
  }

  async findDefaultVariantByProductId(
    storeId: string,
    productId: string,
  ): Promise<ProductVariantRecord | null> {
    const result = await this.databaseService.db.query<ProductVariantRecord>(
      `
        SELECT id, product_id, store_id, title, title_ar, title_en, sku, barcode, price, compare_at_price, stock_quantity, low_stock_threshold, attributes, is_default
        FROM product_variants
        WHERE store_id = $1
          AND product_id = $2
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
      `,
      [storeId, productId],
    );
    return result.rows[0] ?? null;
  }

  private buildListQuery(input: {
    storeId: string;
    q?: string | undefined;
    status?: ProductStatus | undefined;
    categoryId?: string | undefined;
    productType?: ProductType | undefined;
    isVisible?: boolean | undefined;
    isFeatured?: boolean | undefined;
    brand?: string | undefined;
    attributeFilters?: ProductListAttributeFilter[] | undefined;
    filterValueFilters?: ProductListFilterValueFilter[] | undefined;
    filterRangeFilters?: ProductListFilterRangeFilter[] | undefined;
    brandFilter?: string[] | undefined;
    warehouseFilter?: string[] | undefined;
    inStockOnly?: boolean;
    priceMin?: number | undefined;
    priceMax?: number | undefined;
  }): { whereClause: string; values: unknown[]; nextParam: number } {
    const conditions: string[] = ['p.store_id = $1'];
    const values: unknown[] = [input.storeId];
    let nextParam = 2;

    if (input.status) {
      conditions.push(`p.status = $${nextParam}::text`);
      values.push(input.status);
      nextParam += 1;
    }

    if (input.categoryId) {
      conditions.push(
        `(p.category_id = $${nextParam}::uuid OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.store_id = p.store_id AND pc.product_id = p.id AND pc.category_id = $${nextParam}::uuid))`,
      );
      values.push(input.categoryId);
      nextParam += 1;
    }

    if (input.productType) {
      conditions.push(`p.product_type = $${nextParam}::text`);
      values.push(input.productType);
      nextParam += 1;
    }

    if (input.isVisible !== undefined) {
      conditions.push(`p.is_visible = $${nextParam}::boolean`);
      values.push(input.isVisible);
      nextParam += 1;
    }

    if (input.isFeatured !== undefined) {
      conditions.push(`p.is_featured = $${nextParam}::boolean`);
      values.push(input.isFeatured);
      nextParam += 1;
    }

    if (input.brand) {
      conditions.push(`p.brand = $${nextParam}::text`);
      values.push(input.brand);
      nextParam += 1;
    }

    if (input.q) {
      conditions.push(
        `(p.title ILIKE '%' || $${nextParam}::text || '%' OR p.title_ar ILIKE '%' || $${nextParam}::text || '%' OR p.title_en ILIKE '%' || $${nextParam}::text || '%' OR p.slug ILIKE '%' || $${nextParam}::text || '%')`,
      );
      values.push(input.q);
      nextParam += 1;
    }

    const filters = input.attributeFilters ?? [];
    for (const filter of filters) {
      conditions.push(this.buildAttributeFilterClause(nextParam, nextParam + 1));
      values.push(filter.attributeSlug, filter.valueSlugs);
      nextParam += 2;
    }

    const filterValueFilters = input.filterValueFilters ?? [];
    for (const filter of filterValueFilters) {
      conditions.push(this.buildFilterValueFilterClause(nextParam, nextParam + 1));
      values.push(filter.filterSlug, filter.valueSlugs);
      nextParam += 2;
    }

    const filterRangeFilters = input.filterRangeFilters ?? [];
    for (const filter of filterRangeFilters) {
      conditions.push(this.buildFilterRangeFilterClause(nextParam, nextParam + 1, nextParam + 2));
      values.push(filter.filterSlug, filter.min ?? null, filter.max ?? null);
      nextParam += 3;
    }

    if (input.brandFilter && input.brandFilter.length > 0) {
      conditions.push(this.buildBrandFilterClause(nextParam, nextParam + 1));
      values.push(input.storeId, input.brandFilter);
      nextParam += 2;
    }

    if (input.priceMin !== undefined || input.priceMax !== undefined) {
      conditions.push(this.buildPriceFilterClause(nextParam, nextParam + 1));
      values.push(input.priceMin ?? null, input.priceMax ?? null);
      nextParam += 2;
    }

    if (input.warehouseFilter && input.warehouseFilter.length > 0) {
      conditions.push(this.buildWarehouseFilterClause(nextParam, nextParam + 1));
      values.push(input.storeId, input.warehouseFilter);
      nextParam += 2;
    }

    if (input.inStockOnly) {
      conditions.push(this.buildInStockFilterClause(nextParam));
      values.push(input.storeId);
      nextParam += 1;
    }

    return {
      whereClause: conditions.join(' AND '),
      values,
      nextParam,
    };
  }

  private buildAttributeFilterClause(attributeSlugParam: number, valueSlugsParam: number): string {
    return `EXISTS (
      SELECT 1
      FROM product_variants pv
      INNER JOIN variant_attribute_values vav
        ON vav.variant_id = pv.id
       AND vav.store_id = pv.store_id
      INNER JOIN attributes a
        ON a.id = vav.attribute_id
       AND a.store_id = pv.store_id
      INNER JOIN attribute_values av
        ON av.id = vav.attribute_value_id
       AND av.store_id = pv.store_id
      WHERE pv.store_id = p.store_id
        AND pv.product_id = p.id
        AND a.slug = $${attributeSlugParam}
        AND av.slug = ANY($${valueSlugsParam}::text[])
    )`;
  }

  private buildFilterValueFilterClause(filterSlugParam: number, valueSlugsParam: number): string {
    return `EXISTS (
      SELECT 1
      FROM product_filter_values pfv
      INNER JOIN filter_values fv
        ON fv.id = pfv.filter_value_id
       AND fv.store_id = pfv.store_id
      INNER JOIN filters f
        ON f.id = fv.filter_id
       AND f.store_id = fv.store_id
      WHERE pfv.store_id = p.store_id
        AND pfv.product_id = p.id
        AND f.slug = $${filterSlugParam}
        AND fv.slug = ANY($${valueSlugsParam}::text[])
    )`;
  }

  private buildFilterRangeFilterClause(
    filterSlugParam: number,
    minParam: number,
    maxParam: number,
  ): string {
    return `EXISTS (
      SELECT 1
      FROM product_filter_ranges pfr
      INNER JOIN filters f
        ON f.id = pfr.filter_id
       AND f.store_id = pfr.store_id
      WHERE pfr.store_id = p.store_id
        AND pfr.product_id = p.id
        AND f.slug = $${filterSlugParam}
        AND ($${minParam}::numeric IS NULL OR pfr.numeric_value >= $${minParam}::numeric)
        AND ($${maxParam}::numeric IS NULL OR pfr.numeric_value <= $${maxParam}::numeric)
    )`;
  }

  private buildBrandFilterClause(storeIdParam: number, brandSlugsParam: number): string {
    return `p.brand_id IN (
      SELECT b.id FROM brands b
      WHERE b.store_id = $${storeIdParam}::uuid
        AND b.is_active = TRUE
        AND (
          b.name_ar ILIKE ANY($${brandSlugsParam}::text[])
          OR b.name_en ILIKE ANY($${brandSlugsParam}::text[])
          OR LOWER(b.name_ar) = ANY($${brandSlugsParam}::text[])
          OR LOWER(b.name_en) = ANY($${brandSlugsParam}::text[])
          OR b.id::text = ANY($${brandSlugsParam}::text[])
        )
    )`;
  }

  private buildPriceFilterClause(minParam: number, maxParam: number): string {
    return `EXISTS (
      SELECT 1
      FROM product_variants pv2
      WHERE pv2.store_id = p.store_id
        AND pv2.product_id = p.id
        AND ($${minParam}::numeric IS NULL OR pv2.price >= $${minParam}::numeric)
        AND ($${maxParam}::numeric IS NULL OR pv2.price <= $${maxParam}::numeric)
    )`;
  }

  private buildWarehouseFilterClause(storeIdParam: number, warehouseSlugsParam: number): string {
    return `EXISTS (
      SELECT 1
      FROM product_variants pv3
      INNER JOIN warehouse_inventory wi
        ON wi.variant_id = pv3.id
       AND wi.store_id = pv3.store_id
      INNER JOIN warehouses w
        ON w.id = wi.warehouse_id
       AND w.store_id = wi.store_id
      WHERE pv3.store_id = $${storeIdParam}::uuid
        AND pv3.store_id = p.store_id
        AND pv3.product_id = p.id
        AND w.is_active = TRUE
        AND (
          w.code = ANY($${warehouseSlugsParam}::text[])
          OR w.id::text = ANY($${warehouseSlugsParam}::text[])
        )
        AND (wi.quantity - wi.reserved_quantity) > 0
    )`;
  }

  private buildInStockFilterClause(storeIdParam: number): string {
    return `EXISTS (
      SELECT 1
      FROM product_variants pv4
      LEFT JOIN warehouse_inventory wi2
        ON wi2.variant_id = pv4.id
       AND wi2.store_id = pv4.store_id
      WHERE pv4.store_id = p.store_id
        AND pv4.product_id = p.id
        AND (
          p.stock_unlimited = TRUE
          OR pv4.stock_quantity > 0
          OR EXISTS (
            SELECT 1 FROM warehouse_inventory wi3
            WHERE wi3.store_id = $${storeIdParam}
              AND wi3.variant_id = pv4.id
              AND (wi3.quantity - wi3.reserved_quantity) > 0
          )
        )
    )`;
  }

  async setPublishedAt(storeId: string, productId: string): Promise<void> {
    await this.databaseService.db.query(
      `UPDATE products SET published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE store_id = $1 AND id = $2`,
      [storeId, productId],
    );
  }

  async updateRating(
    storeId: string,
    productId: string,
    avg: number,
    count: number,
  ): Promise<void> {
    await this.databaseService.db.query(
      `UPDATE products SET rating_avg = $3, rating_count = $4, updated_at = NOW() WHERE store_id = $1 AND id = $2`,
      [storeId, productId, avg, count],
    );
  }
}
