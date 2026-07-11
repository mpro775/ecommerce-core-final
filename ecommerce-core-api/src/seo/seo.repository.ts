import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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

export interface StorePageRecord {
  id: string;
  store_id: string;
  slug: string;
  page_key: string | null;
  page_type: string;
  title_ar: string | null;
  title_en: string | null;
  content_ar: string | null;
  content_en: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  seo_title_ar: string | null;
  seo_title_en: string | null;
  seo_description_ar: string | null;
  seo_description_en: string | null;
  og_image: string | null;
  faq_items: Array<Record<string, unknown>>;
  seo_index: boolean;
  seo_follow: boolean;
  show_in_header: boolean;
  show_in_footer: boolean;
  sort_order: number;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeoStoreProfile {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  city: string | null;
  address_details: string | null;
  working_hours: Array<{
    day: string;
    isClosed: boolean;
    slots?: Array<{ open: string; close: string }>;
  }>;
  social_links: Record<string, unknown>;
  shipping_policy: string | null;
  return_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
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

const PAGE_COLUMNS = `
  id, store_id, slug, page_key, page_type, title_ar, title_en, content_ar, content_en,
  excerpt_ar, excerpt_en, seo_title_ar, seo_title_en, seo_description_ar,
  seo_description_en, og_image, faq_items, seo_index, seo_follow,
  show_in_header, show_in_footer, sort_order, status, published_at, created_at, updated_at
`;

@Injectable()
export class SeoRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSettings(storeId: string): Promise<Record<string, unknown>> {
    const result = await this.databaseService.db.query<{ seo_settings: Record<string, unknown> }>(
      `SELECT seo_settings FROM stores WHERE id = $1 LIMIT 1`,
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
        SELECT id, name, name_ar, name_en, description_ar, description_en,
               phone, address, country, city, address_details, working_hours, social_links,
               shipping_policy, return_policy, privacy_policy, terms_of_service, seo_settings
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async listPages(storeId: string, includeDrafts: boolean): Promise<StorePageRecord[]> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1
          AND ($2::boolean = TRUE OR status = 'published')
        ORDER BY sort_order ASC, created_at DESC
      `,
      [storeId, includeDrafts],
    );
    return result.rows;
  }

  async findPageById(storeId: string, pageId: string): Promise<StorePageRecord | null> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1 AND id = $2
        LIMIT 1
      `,
      [storeId, pageId],
    );
    return result.rows[0] ?? null;
  }

  async findPageByKey(storeId: string, pageKey: string): Promise<StorePageRecord | null> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1 AND page_key = $2
        LIMIT 1
      `,
      [storeId, pageKey],
    );
    return result.rows[0] ?? null;
  }

  async findPublishedPageBySlug(storeId: string, slug: string): Promise<StorePageRecord | null> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1 AND slug = $2 AND status = 'published'
        LIMIT 1
      `,
      [storeId, slug],
    );
    return result.rows[0] ?? null;
  }

  async findPageBySlug(storeId: string, slug: string): Promise<StorePageRecord | null> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1 AND slug = $2
        LIMIT 1
      `,
      [storeId, slug],
    );
    return result.rows[0] ?? null;
  }

  async createPage(storeId: string, input: StorePageInput): Promise<StorePageRecord> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        INSERT INTO store_pages (
          id, store_id, slug, page_key, page_type, title_ar, title_en, content_ar, content_en,
          excerpt_ar, excerpt_en, seo_title_ar, seo_title_en, seo_description_ar,
          seo_description_en, og_image, faq_items, seo_index, seo_follow,
          show_in_header, show_in_footer, sort_order, status, published_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21, $22, $23,
          CASE WHEN $23 = 'published' THEN NOW() ELSE NULL END
        )
        RETURNING ${PAGE_COLUMNS}
      `,
      [
        uuidv4(),
        storeId,
        input.slug,
        input.pageKey,
        input.pageType,
        input.titleAr,
        input.titleEn,
        input.contentAr,
        input.contentEn,
        input.excerptAr,
        input.excerptEn,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        input.ogImage,
        JSON.stringify(input.faqItems),
        input.seoIndex,
        input.seoFollow,
        input.showInHeader,
        input.showInFooter,
        input.sortOrder,
        input.status,
      ],
    );
    return result.rows[0] as StorePageRecord;
  }

  async updatePage(
    storeId: string,
    pageId: string,
    input: StorePageInput,
  ): Promise<StorePageRecord | null> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        UPDATE store_pages
        SET slug = $3,
            page_key = $4,
            page_type = $5,
            title_ar = $6,
            title_en = $7,
            content_ar = $8,
            content_en = $9,
            excerpt_ar = $10,
            excerpt_en = $11,
            seo_title_ar = $12,
            seo_title_en = $13,
            seo_description_ar = $14,
            seo_description_en = $15,
            og_image = $16,
            faq_items = $17::jsonb,
            seo_index = $18,
            seo_follow = $19,
            show_in_header = $20,
            show_in_footer = $21,
            sort_order = $22,
            status = $23,
            published_at = CASE
              WHEN $23 = 'published' AND published_at IS NULL THEN NOW()
              WHEN $23 != 'published' THEN NULL
              ELSE published_at
            END,
            updated_at = NOW()
        WHERE store_id = $1 AND id = $2
        RETURNING ${PAGE_COLUMNS}
      `,
      [
        storeId,
        pageId,
        input.slug,
        input.pageKey,
        input.pageType,
        input.titleAr,
        input.titleEn,
        input.contentAr,
        input.contentEn,
        input.excerptAr,
        input.excerptEn,
        input.seoTitleAr,
        input.seoTitleEn,
        input.seoDescriptionAr,
        input.seoDescriptionEn,
        input.ogImage,
        JSON.stringify(input.faqItems),
        input.seoIndex,
        input.seoFollow,
        input.showInHeader,
        input.showInFooter,
        input.sortOrder,
        input.status,
      ],
    );
    return result.rows[0] ?? null;
  }

  async deletePage(storeId: string, pageId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `DELETE FROM store_pages WHERE store_id = $1 AND id = $2`,
      [storeId, pageId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async pageSlugExists(storeId: string, slug: string, exceptPageId?: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1 FROM store_pages
          WHERE store_id = $1 AND slug = $2 AND ($3::uuid IS NULL OR id != $3::uuid)
        ) AS exists
      `,
      [storeId, slug, exceptPageId ?? null],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async auditCounts(storeId: string): Promise<Record<string, number>> {
    const result = await this.databaseService.db.query<Record<string, string>>(
      `
        SELECT
          (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active' AND (seo_title_ar IS NULL OR seo_description_ar IS NULL))::text AS products_missing_ar,
          (SELECT COUNT(*) FROM products WHERE store_id = $1 AND status = 'active' AND (seo_title_en IS NULL OR seo_description_en IS NULL))::text AS products_missing_en,
          (SELECT COUNT(*) FROM categories WHERE store_id = $1 AND is_active = TRUE AND (seo_title_ar IS NULL OR seo_description_ar IS NULL))::text AS categories_missing_ar,
          (SELECT COUNT(*) FROM categories WHERE store_id = $1 AND is_active = TRUE AND (seo_title_en IS NULL OR seo_description_en IS NULL))::text AS categories_missing_en,
          (SELECT COUNT(*) FROM store_pages WHERE store_id = $1 AND status = 'published' AND (seo_title_ar IS NULL OR seo_title_en IS NULL OR seo_description_ar IS NULL OR seo_description_en IS NULL))::text AS pages_missing_seo
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

  async findCategoryForSeo(storeId: string, categoryId: string): Promise<SeoCategoryRecord | null> {
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

  async listPagesForSeo(storeId: string, limit = 100): Promise<StorePageRecord[]> {
    const result = await this.databaseService.db.query<StorePageRecord>(
      `
        SELECT ${PAGE_COLUMNS}
        FROM store_pages
        WHERE store_id = $1
          AND status = 'published'
          AND (
            seo_title_ar IS NULL OR seo_description_ar IS NULL OR
            seo_title_en IS NULL OR seo_description_en IS NULL OR
            LENGTH(COALESCE(seo_title_ar, seo_title_en, '')) < 30 OR
            LENGTH(COALESCE(seo_description_ar, seo_description_en, '')) < 80
          )
        ORDER BY sort_order ASC, created_at DESC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows;
  }

  async updateProductSeo(
    storeId: string,
    productId: string,
    fields: Partial<
      Pick<StorePageInput, 'seoTitleAr' | 'seoTitleEn' | 'seoDescriptionAr' | 'seoDescriptionEn'>
    >,
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
        `${column} = CASE WHEN $${values.length}::text IS NULL THEN ${column} ${overwriteExisting ? `ELSE $${values.length}` : `ELSE COALESCE(${column}, $${values.length})`} END`,
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
    fields: Partial<
      Pick<StorePageInput, 'seoTitleAr' | 'seoTitleEn' | 'seoDescriptionAr' | 'seoDescriptionEn'>
    >,
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

  async logFixes(
    storeId: string,
    details: Array<{
      scope: string;
      targetId: string | null;
      targetName: string;
      targetTitle: string;
      status: string;
      fields: string[];
      fieldsUpdated?: string[];
      reason: string | null;
    }>,
    options: { scope: string; actorId: string; source: string; fixType: string },
  ): Promise<void> {
    const rows = details.filter(
      (detail) =>
        detail.status === 'fixed' || detail.status === 'skipped' || detail.status === 'failed',
    );
    for (const detail of rows) {
      await this.databaseService.db.query(
        `
          INSERT INTO seo_fix_logs (
            id, store_id, actor_id, actor_type, scope, target_id, target_name,
            fix_type, fields_changed, old_values, new_values, source, status, reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)
          ON CONFLICT DO NOTHING
        `,
        [
          uuidv4(),
          storeId,
          options.actorId,
          'merchant',
          detail.scope || options.scope,
          detail.targetId,
          detail.targetName || detail.targetTitle,
          options.fixType,
          JSON.stringify(detail.fieldsUpdated ?? detail.fields ?? []),
          JSON.stringify({}),
          JSON.stringify({ fields: detail.fieldsUpdated ?? detail.fields ?? [] }),
          options.source,
          detail.status,
          detail.reason,
        ],
      );
    }
  }

  async logAuditRun(
    storeId: string,
    audit: {
      score: number;
      summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        fixable: number;
        manual: number;
      };
    },
  ): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO seo_audit_runs (
          id, store_id, score, critical_count, high_count, medium_count,
          low_count, fixable_count, manual_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        uuidv4(),
        storeId,
        audit.score,
        audit.summary.critical,
        audit.summary.high,
        audit.summary.medium,
        audit.summary.low,
        audit.summary.fixable,
        audit.summary.manual,
      ],
    );
  }

  async listFixLogs(
    storeId: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string;
      merchantId: string | null;
      storeId: string;
      actorId: string | null;
      actorType: string;
      scope: string;
      targetId: string | null;
      targetName: string | null;
      fixType: string;
      fieldsChanged: string[];
      oldValues: Record<string, unknown>;
      newValues: Record<string, unknown>;
      source: string;
      status: string;
      reason: string | null;
      createdAt: string;
    }>
  > {
    const result = await this.databaseService.db.query<{
      id: string;
      merchant_id: string | null;
      store_id: string;
      actor_id: string | null;
      actor_type: string;
      scope: string;
      target_id: string | null;
      target_name: string | null;
      fix_type: string;
      fields_changed: string[];
      old_values: Record<string, unknown>;
      new_values: Record<string, unknown>;
      source: string;
      status: string;
      reason: string | null;
      created_at: string;
    }>(
      `
        SELECT id, merchant_id, store_id, actor_id, actor_type, scope, target_id,
               target_name, fix_type, fields_changed, old_values, new_values,
               source, status, reason, created_at
        FROM seo_fix_logs
        WHERE store_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [storeId, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      merchantId: row.merchant_id,
      storeId: row.store_id,
      actorId: row.actor_id,
      actorType: row.actor_type,
      scope: row.scope,
      targetId: row.target_id,
      targetName: row.target_name,
      fixType: row.fix_type,
      fieldsChanged: row.fields_changed ?? [],
      oldValues: row.old_values ?? {},
      newValues: row.new_values ?? {},
      source: row.source,
      status: row.status,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  }
}

export interface StorePageInput {
  slug: string;
  pageKey: string | null;
  pageType: string;
  titleAr: string | null;
  titleEn: string | null;
  contentAr: string | null;
  contentEn: string | null;
  excerptAr: string | null;
  excerptEn: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  ogImage: string | null;
  faqItems: Array<Record<string, unknown>>;
  seoIndex: boolean;
  seoFollow: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
  status: string;
}
