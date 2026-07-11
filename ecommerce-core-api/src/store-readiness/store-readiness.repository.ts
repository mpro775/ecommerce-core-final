import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface SetupProgressRecord {
  step_key: string;
  status: 'skipped' | 'completed';
  skipped_reason: string | null;
  skipped_at: Date | null;
  completed_at: Date | null;
}

export interface StoreReadinessFacts {
  name: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  city: string | null;
  currency_code: string | null;
  working_hours_count: number;
  category_count: number;
  visible_category_count: number;
  brand_count: number;
  attribute_count: number;
  product_count: number;
  visible_product_count: number;
  priced_product_count: number;
  products_with_category_count: number;
  products_with_image_count: number;
  featured_product_count: number;
  enabled_payment_count: number;
  incomplete_payment_count: number;
  active_shipping_method_count: number;
  trust_page_count: number;
  published_trust_page_count: number;
}

@Injectable()
export class StoreReadinessRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getFacts(storeId: string): Promise<StoreReadinessFacts> {
    const result = await this.databaseService.db.query<StoreReadinessFacts>(
      `
        WITH store_row AS (
          SELECT *
          FROM stores
          WHERE id = $1
          LIMIT 1
        ),
        product_stats AS (
          SELECT
            COUNT(*)::int AS product_count,
            COUNT(*) FILTER (WHERE p.status = 'active' AND p.is_visible = TRUE)::int AS visible_product_count,
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM product_variants pv
                WHERE pv.store_id = p.store_id
                  AND pv.product_id = p.id
                  AND pv.price > 0
              )
            )::int AS priced_product_count,
            COUNT(*) FILTER (
              WHERE p.category_id IS NOT NULL
                 OR EXISTS (
                   SELECT 1
                   FROM product_categories pc
                   WHERE pc.store_id = p.store_id
                     AND pc.product_id = p.id
                 )
            )::int AS products_with_category_count,
            COUNT(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM product_images pi
                WHERE pi.store_id = p.store_id
                  AND pi.product_id = p.id
              )
            )::int AS products_with_image_count,
            COUNT(*) FILTER (WHERE p.is_featured = TRUE)::int AS featured_product_count
          FROM products p
          WHERE p.store_id = $1
            AND p.status <> 'archived'
        ),
        payment_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE spm.is_enabled = TRUE AND ppm.is_enabled = TRUE)::int AS enabled_payment_count,
            COUNT(*) FILTER (
              WHERE spm.is_enabled = TRUE
                AND ppm.is_enabled = TRUE
                AND ppm.type <> 'cod'
                AND (NULLIF(TRIM(COALESCE(spm.account_name, '')), '') IS NULL
                  OR NULLIF(TRIM(COALESCE(spm.account_number, '')), '') IS NULL)
            )::int AS incomplete_payment_count
          FROM store_payment_methods spm
          INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
          WHERE spm.store_id = $1
        ),
        shipping_stats AS (
          SELECT COUNT(*)::int AS active_shipping_method_count
          FROM shipping_methods sm
          INNER JOIN shipping_zones sz ON sz.id = sm.shipping_zone_id
          WHERE sm.store_id = $1
            AND sm.is_active = TRUE
            AND sz.is_active = TRUE
        ),
        page_stats AS (
          SELECT
            COUNT(*) FILTER (
              WHERE page_key IN ('about', 'contact', 'shipping_policy', 'return_policy', 'privacy_policy', 'terms', 'faq')
                OR page_type IN ('about', 'contact', 'faq', 'policy')
            )::int AS trust_page_count,
            COUNT(*) FILTER (
              WHERE status = 'published'
                AND (
                  page_key IN ('about', 'contact', 'shipping_policy', 'return_policy', 'privacy_policy', 'terms', 'faq')
                  OR page_type IN ('about', 'contact', 'faq', 'policy')
                )
            )::int AS published_trust_page_count
          FROM store_pages
          WHERE store_id = $1
        )
        SELECT
          s.name,
          COALESCE(NULLIF(s.description_ar, ''), NULLIF(s.description_en, '')) AS description,
          s.logo_url,
          s.phone,
          s.city,
          s.currency_code,
          CASE WHEN jsonb_typeof(s.working_hours) = 'array' THEN jsonb_array_length(s.working_hours) ELSE 0 END::int AS working_hours_count,
          (SELECT COUNT(*)::int FROM categories WHERE store_id = $1) AS category_count,
          (SELECT COUNT(*)::int FROM categories WHERE store_id = $1 AND is_active = TRUE) AS visible_category_count,
          (SELECT COUNT(*)::int FROM brands WHERE store_id = $1 AND is_active = TRUE) AS brand_count,
          (SELECT COUNT(*)::int FROM attributes WHERE store_id = $1 AND is_active = TRUE) AS attribute_count,
          COALESCE(ps.product_count, 0) AS product_count,
          COALESCE(ps.visible_product_count, 0) AS visible_product_count,
          COALESCE(ps.priced_product_count, 0) AS priced_product_count,
          COALESCE(ps.products_with_category_count, 0) AS products_with_category_count,
          COALESCE(ps.products_with_image_count, 0) AS products_with_image_count,
          COALESCE(ps.featured_product_count, 0) AS featured_product_count,
          COALESCE(pay.enabled_payment_count, 0) AS enabled_payment_count,
          COALESCE(pay.incomplete_payment_count, 0) AS incomplete_payment_count,
          COALESCE(ship.active_shipping_method_count, 0) AS active_shipping_method_count,
          COALESCE(pg.trust_page_count, 0) AS trust_page_count,
          COALESCE(pg.published_trust_page_count, 0) AS published_trust_page_count
        FROM store_row s
        CROSS JOIN product_stats ps
        CROSS JOIN payment_stats pay
        CROSS JOIN shipping_stats ship
        CROSS JOIN page_stats pg
      `,
      [storeId],
    );

    return result.rows[0] as StoreReadinessFacts;
  }

  async listProgress(storeId: string): Promise<Map<string, SetupProgressRecord>> {
    const result = await this.databaseService.db.query<SetupProgressRecord>(
      `
        SELECT step_key, status, skipped_reason, skipped_at, completed_at
        FROM store_setup_progress
        WHERE store_id = $1
      `,
      [storeId],
    );
    return new Map(result.rows.map((row) => [row.step_key, row]));
  }

  async skipStep(storeId: string, stepKey: string, reason: string | null): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO store_setup_progress (
          id, store_id, step_key, status, skipped_reason, skipped_at, completed_at
        ) VALUES ($1, $2, $3, 'skipped', $4, NOW(), NULL)
        ON CONFLICT (store_id, step_key)
        DO UPDATE SET
          status = 'skipped',
          skipped_reason = EXCLUDED.skipped_reason,
          skipped_at = NOW(),
          completed_at = NULL,
          updated_at = NOW()
      `,
      [uuidv4(), storeId, stepKey, reason],
    );
  }

  async unskipStep(storeId: string, stepKey: string): Promise<void> {
    await this.databaseService.db.query(
      `
        DELETE FROM store_setup_progress
        WHERE store_id = $1
          AND step_key = $2
          AND status = 'skipped'
      `,
      [storeId, stepKey],
    );
  }

  async enableCodPayment(storeId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ id: string }>(
      `
        WITH cod AS (
          SELECT id, sort_order
          FROM platform_payment_methods
          WHERE is_enabled = TRUE
            AND type = 'cod'
          ORDER BY sort_order ASC, created_at ASC
          LIMIT 1
        ),
        inserted AS (
          INSERT INTO store_payment_methods (id, store_id, platform_payment_method_id, is_enabled, sort_order)
          SELECT $2, $1, cod.id, TRUE, cod.sort_order
          FROM cod
          ON CONFLICT (store_id, platform_payment_method_id)
          DO UPDATE SET is_enabled = TRUE, updated_at = NOW()
          RETURNING id
        )
        SELECT id FROM inserted
      `,
      [storeId, uuidv4()],
    );
    return result.rows.length > 0;
  }
}
