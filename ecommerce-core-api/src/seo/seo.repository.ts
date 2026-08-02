import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface StoreSeoSettings {
  homeSeoTitleAr: string | null;
  homeSeoTitleEn: string | null;
  homeSeoDescriptionAr: string | null;
  homeSeoDescriptionEn: string | null;
  defaultSeoTitleAr: string | null;
  defaultSeoTitleEn: string | null;
  defaultSeoDescriptionAr: string | null;
  defaultSeoDescriptionEn: string | null;
  defaultOgImage: string | null;
  defaultTwitterImage: string | null;
  keywords: string[];
  googleSiteVerification: string | null;
  googleAnalyticsMeasurementId: string | null;
  bingSiteVerification: string | null;
  facebookDomainVerification: string | null;
  seoIndexEnabled: boolean;
  seoFollowDefault: boolean;
  canonicalBaseUrl: string | null;
  defaultLanguage: 'ar' | 'en';
  supportedLanguages: Array<'ar' | 'en'>;
}

export interface SeoStoreProfile {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  seo_settings: Record<string, unknown>;
}

export interface SeoProductRecord {
  id: string;
  title: string;
  title_ar: string | null;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  short_description_ar: string | null;
  short_description_en: string | null;
  brand: string | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  category_name: string | null;
  category_name_ar: string | null;
  category_name_en: string | null;
}

export interface SeoCategoryRecord {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
}

export interface SeoFieldsInput {
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
}

@Injectable()
export class SeoRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSettings(storeId: string): Promise<Record<string, unknown>> {
    const result = await this.databaseService.db.query<{ seo_settings: Record<string, unknown> }>(
      'SELECT seo_settings FROM stores WHERE id = $1 LIMIT 1',
      [storeId],
    );
    return result.rows[0]?.seo_settings ?? {};
  }

  async updateSettings(
    storeId: string,
    settings: StoreSeoSettings,
  ): Promise<Record<string, unknown>> {
    const result = await this.databaseService.db.query<{ seo_settings: Record<string, unknown> }>(
      `
        UPDATE stores
        SET seo_settings = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING seo_settings
      `,
      [storeId, JSON.stringify(settings)],
    );
    return result.rows[0]?.seo_settings ?? {};
  }

  async getStoreProfile(storeId: string): Promise<SeoStoreProfile | null> {
    const result = await this.databaseService.db.query<SeoStoreProfile>(
      `
        SELECT id, name, name_ar, name_en, description_ar, description_en, seo_settings
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async auditCounts(storeId: string): Promise<Record<string, number>> {
    const result = await this.databaseService.db.query<Record<string, string>>(
      `
        SELECT
          (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active' AND (seo_title_ar IS NULL OR seo_description_ar IS NULL))::text AS products_missing_ar,
          (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active' AND (seo_title_en IS NULL OR seo_description_en IS NULL))::text AS products_missing_en,
          (SELECT COUNT(*) FROM categories WHERE store_id = $1 AND is_active = TRUE AND (seo_title_ar IS NULL OR seo_description_ar IS NULL))::text AS categories_missing_ar,
          (SELECT COUNT(*) FROM categories WHERE store_id = $1 AND is_active = TRUE AND (seo_title_en IS NULL OR seo_description_en IS NULL))::text AS categories_missing_en
      `,
      [storeId],
    );
    const row = result.rows[0] ?? {};
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]));
  }

  async listProductsForSeo(storeId: string, limit = 100): Promise<SeoProductRecord[]> {
    const result = await this.databaseService.db.query<SeoProductRecord>(
      `
        SELECT p.id, p.title, p.title_ar, p.title_en, p.description_ar, p.description_en,
               p.short_description_ar, p.short_description_en, p.brand,
               p.seo_title_ar, p.seo_title_en, p.seo_description_ar, p.seo_description_en,
               c.name AS category_name, c.name_ar AS category_name_ar, c.name_en AS category_name_en
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.store_id = $1
          AND p.status = 'active'
          AND (
            p.seo_title_ar IS NULL OR p.seo_description_ar IS NULL OR
            p.seo_title_en IS NULL OR p.seo_description_en IS NULL OR
            LENGTH(COALESCE(p.seo_title_ar, p.seo_title_en, '')) < 30 OR
            LENGTH(COALESCE(p.seo_description_ar, p.seo_description_en, '')) < 80
          )
        ORDER BY p.published_at DESC NULLS LAST, p.title ASC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async findProductForSeo(storeId: string, productId: string): Promise<SeoProductRecord | null> {
    const result = await this.databaseService.db.query<SeoProductRecord>(
      `
        SELECT p.id, p.title, p.title_ar, p.title_en, p.description_ar, p.description_en,
               p.short_description_ar, p.short_description_en, p.brand,
               p.seo_title_ar, p.seo_title_en, p.seo_description_ar, p.seo_description_en,
               c.name AS category_name, c.name_ar AS category_name_ar, c.name_en AS category_name_en
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.store_id = $1 AND p.id = $2
        LIMIT 1
      `,
      [storeId, productId],
    );
    return result.rows[0] ?? null;
  }

  async listCategoriesForSeo(storeId: string, limit = 100): Promise<SeoCategoryRecord[]> {
    const result = await this.databaseService.db.query<SeoCategoryRecord>(
      `
        SELECT id, name, name_ar, name_en, description_ar, description_en,
               seo_title_ar, seo_title_en, seo_description_ar, seo_description_en
        FROM categories
        WHERE store_id = $1
          AND is_active = TRUE
          AND (
            seo_title_ar IS NULL OR seo_description_ar IS NULL OR
            seo_title_en IS NULL OR seo_description_en IS NULL OR
            LENGTH(COALESCE(seo_title_ar, seo_title_en, '')) < 30 OR
            LENGTH(COALESCE(seo_description_ar, seo_description_en, '')) < 80
          )
        ORDER BY sort_order ASC, name ASC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async findCategoryForSeo(
    storeId: string,
    categoryId: string,
  ): Promise<SeoCategoryRecord | null> {
    const result = await this.databaseService.db.query<SeoCategoryRecord>(
      `
        SELECT id, name, name_ar, name_en, description_ar, description_en,
               seo_title_ar, seo_title_en, seo_description_ar, seo_description_en
        FROM categories
        WHERE store_id = $1 AND id = $2
        LIMIT 1
      `,
      [storeId, categoryId],
    );
    return result.rows[0] ?? null;
  }

  async updateProductSeo(
    storeId: string,
    productId: string,
    fields: Partial<SeoFieldsInput>,
    overwriteExisting: boolean,
  ): Promise<string[]> {
    const setParts: string[] = [];
    const values: unknown[] = [storeId, productId];
    const mapping = [
      ['seoTitleAr', 'seo_title_ar'],
      ['seoTitleEn', 'seo_title_en'],
      ['seoDescriptionAr', 'seo_description_ar'],
      ['seoDescriptionEn', 'seo_description_en'],
    ] as const;
    for (const [key, column] of mapping) {
      const value = fields[key];
      if (!value) continue;
      values.push(value);
      setParts.push(
        `${column} = ${overwriteExisting ? `$${values.length}` : `COALESCE(${column}, $${values.length})`}`,
      );
    }
    if (!setParts.length) return [];
    await this.databaseService.db.query(
      `UPDATE products SET ${setParts.join(', ')}, updated_at = NOW() WHERE store_id = $1 AND id = $2`,
      values,
    );
    return Object.keys(fields).filter((key) => Boolean(fields[key as keyof typeof fields]));
  }

  async updateCategorySeo(
    storeId: string,
    categoryId: string,
    fields: Partial<SeoFieldsInput>,
    overwriteExisting: boolean,
  ): Promise<string[]> {
    const setParts: string[] = [];
    const values: unknown[] = [storeId, categoryId];
    const mapping = [
      ['seoTitleAr', 'seo_title_ar'],
      ['seoTitleEn', 'seo_title_en'],
      ['seoDescriptionAr', 'seo_description_ar'],
      ['seoDescriptionEn', 'seo_description_en'],
    ] as const;
    for (const [key, column] of mapping) {
      const value = fields[key];
      if (!value) continue;
      values.push(value);
      setParts.push(
        `${column} = ${overwriteExisting ? `$${values.length}` : `COALESCE(${column}, $${values.length})`}`,
      );
    }
    if (!setParts.length) return [];
    await this.databaseService.db.query(
      `UPDATE categories SET ${setParts.join(', ')}, updated_at = NOW() WHERE store_id = $1 AND id = $2`,
      values,
    );
    return Object.keys(fields).filter((key) => Boolean(fields[key as keyof typeof fields]));
  }
}
