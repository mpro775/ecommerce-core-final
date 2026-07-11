import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type {
  AffiliateAttributionType,
  AffiliateCommissionStatus,
  AffiliatePayoutBatchStatus,
  AffiliateStatus,
} from './constants/affiliate.constants';

export interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface AffiliateRecord {
  id: string;
  store_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: AffiliateStatus;
  commission_rate_percent: string;
  payout_method: string | null;
  payout_details: Record<string, unknown>;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AffiliateLinkRecord {
  id: string;
  store_id: string;
  affiliate_id: string;
  code: string;
  target_path: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AffiliateClickAttributionRecord {
  affiliate_id: string;
  affiliate_link_id: string | null;
  source: AffiliateAttributionType;
}

export interface AffiliateCommissionRow {
  id: string;
  order_id: string;
  order_code: string;
  affiliate_id: string;
  affiliate_name: string;
  status: AffiliateCommissionStatus;
  commission_base: string;
  commission_amount: string;
  reversed_amount: string;
  net_amount: string;
  approved_at: Date | null;
  paid_at: Date | null;
  reversed_at: Date | null;
  created_at: Date;
}

export interface AffiliatePayoutBatchRow {
  id: string;
  status: AffiliatePayoutBatchStatus;
  currency_code: string;
  total_amount: string;
  items_count: number;
  note: string | null;
  paid_at: Date | null;
  created_at: Date;
}

export interface AffiliateSettingsRow {
  affiliate_enabled: boolean;
  affiliate_default_rate: string;
  affiliate_attribution_window_days: number;
  affiliate_min_payout: string;
}

@Injectable()
export class AffiliatesRepository {
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

  async getStoreSettings(storeId: string): Promise<AffiliateSettingsRow> {
    const result = await this.databaseService.db.query<AffiliateSettingsRow>(
      `
        SELECT affiliate_enabled, affiliate_default_rate, affiliate_attribution_window_days, affiliate_min_payout
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return (
      result.rows[0] ?? {
        affiliate_enabled: false,
        affiliate_default_rate: '10.00',
        affiliate_attribution_window_days: 30,
        affiliate_min_payout: '5000.00',
      }
    );
  }

  async updateStoreSettings(input: {
    storeId: string;
    enabled: boolean;
    defaultRatePercent: number;
    attributionWindowDays: number;
    minPayoutAmount: number;
  }): Promise<AffiliateSettingsRow> {
    const result = await this.databaseService.db.query<AffiliateSettingsRow>(
      `
        UPDATE stores
        SET affiliate_enabled = $2,
            affiliate_default_rate = $3,
            affiliate_attribution_window_days = $4,
            affiliate_min_payout = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING affiliate_enabled, affiliate_default_rate, affiliate_attribution_window_days, affiliate_min_payout
      `,
      [
        input.storeId,
        input.enabled,
        input.defaultRatePercent,
        input.attributionWindowDays,
        input.minPayoutAmount,
      ],
    );
    return result.rows[0] as AffiliateSettingsRow;
  }

  async createAffiliate(input: {
    storeId: string;
    name: string;
    email: string | null;
    phone: string | null;
    commissionRatePercent: number;
    payoutMethod: string | null;
    notes: string | null;
  }): Promise<AffiliateRecord> {
    const result = await this.databaseService.db.query<AffiliateRecord>(
      `
        INSERT INTO affiliates (
          id, store_id, name, email, phone, status, commission_rate_percent, payout_method, notes
        )
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
        RETURNING id, store_id, name, email, phone, status, commission_rate_percent, payout_method, payout_details, notes, created_at, updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.email,
        input.phone,
        input.commissionRatePercent,
        input.payoutMethod,
        input.notes,
      ],
    );
    return result.rows[0] as AffiliateRecord;
  }

  async listAffiliates(storeId: string, q?: string): Promise<AffiliateRecord[]> {
    const result = await this.databaseService.db.query<AffiliateRecord>(
      `
        SELECT id, store_id, name, email, phone, status, commission_rate_percent, payout_method, payout_details, notes, created_at, updated_at
        FROM affiliates
        WHERE store_id = $1
          AND (
            $2::text IS NULL
            OR name ILIKE '%' || $2 || '%'
            OR COALESCE(email, '') ILIKE '%' || $2 || '%'
            OR COALESCE(phone, '') ILIKE '%' || $2 || '%'
          )
        ORDER BY created_at DESC
      `,
      [storeId, q ?? null],
    );
    return result.rows;
  }

  async findAffiliateById(storeId: string, affiliateId: string): Promise<AffiliateRecord | null> {
    const result = await this.databaseService.db.query<AffiliateRecord>(
      `
        SELECT id, store_id, name, email, phone, status, commission_rate_percent, payout_method, payout_details, notes, created_at, updated_at
        FROM affiliates
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, affiliateId],
    );
    return result.rows[0] ?? null;
  }

  async updateAffiliate(input: {
    storeId: string;
    affiliateId: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: AffiliateStatus;
    commissionRatePercent: number;
    payoutMethod: string | null;
    notes: string | null;
  }): Promise<AffiliateRecord | null> {
    const result = await this.databaseService.db.query<AffiliateRecord>(
      `
        UPDATE affiliates
        SET name = $3,
            email = $4,
            phone = $5,
            status = $6,
            commission_rate_percent = $7,
            payout_method = $8,
            notes = $9,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, name, email, phone, status, commission_rate_percent, payout_method, payout_details, notes, created_at, updated_at
      `,
      [
        input.storeId,
        input.affiliateId,
        input.name,
        input.email,
        input.phone,
        input.status,
        input.commissionRatePercent,
        input.payoutMethod,
        input.notes,
      ],
    );
    return result.rows[0] ?? null;
  }

  async createAffiliateLink(input: {
    storeId: string;
    affiliateId: string;
    code: string;
    targetPath: string;
  }): Promise<AffiliateLinkRecord> {
    const result = await this.databaseService.db.query<AffiliateLinkRecord>(
      `
        INSERT INTO affiliate_links (id, store_id, affiliate_id, code, target_path, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id, store_id, affiliate_id, code, target_path, is_active, created_at, updated_at
      `,
      [uuidv4(), input.storeId, input.affiliateId, input.code, input.targetPath],
    );
    return result.rows[0] as AffiliateLinkRecord;
  }

  async listLinksForAffiliate(
    storeId: string,
    affiliateId: string,
  ): Promise<AffiliateLinkRecord[]> {
    const result = await this.databaseService.db.query<AffiliateLinkRecord>(
      `
        SELECT id, store_id, affiliate_id, code, target_path, is_active, created_at, updated_at
        FROM affiliate_links
        WHERE store_id = $1
          AND affiliate_id = $2
        ORDER BY created_at DESC
      `,
      [storeId, affiliateId],
    );
    return result.rows;
  }

  async findActiveLinkByCode(
    storeId: string,
    code: string,
  ): Promise<{
    link: AffiliateLinkRecord;
    affiliate: AffiliateRecord;
  } | null> {
    const result = await this.databaseService.db.query<AffiliateLinkRecord & AffiliateRecord>(
      `
        SELECT
          l.id, l.store_id, l.affiliate_id, l.code, l.target_path, l.is_active, l.created_at, l.updated_at,
          a.name, a.email, a.phone, a.status, a.commission_rate_percent, a.payout_method, a.payout_details, a.notes
        FROM affiliate_links l
        INNER JOIN affiliates a
          ON a.id = l.affiliate_id
         AND a.store_id = l.store_id
        WHERE l.store_id = $1
          AND LOWER(l.code) = LOWER($2)
          AND l.is_active = TRUE
          AND a.status = 'active'
        LIMIT 1
      `,
      [storeId, code],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      link: {
        id: row.id,
        store_id: row.store_id,
        affiliate_id: row.affiliate_id,
        code: row.code,
        target_path: row.target_path,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      affiliate: {
        id: row.affiliate_id,
        store_id: row.store_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        commission_rate_percent: row.commission_rate_percent,
        payout_method: row.payout_method,
        payout_details: row.payout_details,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  }

  async insertAffiliateClick(input: {
    storeId: string;
    affiliateId: string;
    affiliateLinkId: string | null;
    sessionId: string;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    referrer?: string | null;
    landingPath?: string | null;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO affiliate_clicks (
          id, store_id, affiliate_id, affiliate_link_id, session_id,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, landing_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        uuidv4(),
        input.storeId,
        input.affiliateId,
        input.affiliateLinkId,
        input.sessionId,
        input.utmSource ?? null,
        input.utmMedium ?? null,
        input.utmCampaign ?? null,
        input.utmTerm ?? null,
        input.utmContent ?? null,
        input.referrer ?? null,
        input.landingPath ?? null,
      ],
    );
  }

  async resolveCouponAttribution(
    storeId: string,
    couponCode: string,
  ): Promise<AffiliateClickAttributionRecord | null> {
    const result = await this.databaseService.db.query<AffiliateClickAttributionRecord>(
      `
        SELECT c.affiliate_id, NULL::uuid AS affiliate_link_id, 'coupon'::text AS source
        FROM coupons c
        INNER JOIN affiliates a
          ON a.id = c.affiliate_id
         AND a.store_id = c.store_id
        WHERE c.store_id = $1
          AND LOWER(c.code) = LOWER($2)
          AND c.affiliate_id IS NOT NULL
          AND a.status = 'active'
        LIMIT 1
      `,
      [storeId, couponCode],
    );
    return result.rows[0] ?? null;
  }

  async resolveLastClickAttribution(input: {
    storeId: string;
    sessionId: string;
    windowDays: number;
  }): Promise<AffiliateClickAttributionRecord | null> {
    const result = await this.databaseService.db.query<AffiliateClickAttributionRecord>(
      `
        SELECT ac.affiliate_id, ac.affiliate_link_id, 'link'::text AS source
        FROM affiliate_clicks ac
        INNER JOIN affiliates a
          ON a.id = ac.affiliate_id
         AND a.store_id = ac.store_id
        WHERE ac.store_id = $1
          AND ac.session_id = $2
          AND ac.clicked_at >= NOW() - ($3::int || ' days')::interval
          AND a.status = 'active'
        ORDER BY ac.clicked_at DESC
        LIMIT 1
      `,
      [input.storeId, input.sessionId, input.windowDays],
    );
    return result.rows[0] ?? null;
  }

  async createOrderAttributionAndCommission(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      affiliateId: string;
      affiliateLinkId: string | null;
      couponId: string | null;
      couponCode: string | null;
      attributionType: AffiliateAttributionType;
      sessionId: string | null;
      commissionRatePercent: number;
      commissionBase: number;
      commissionAmount: number;
    },
  ): Promise<void> {
    const attributionId = uuidv4();
    const inserted = await db.query<{ id: string }>(
      `
        INSERT INTO order_affiliate_attributions (
          id, store_id, order_id, affiliate_id, affiliate_link_id, coupon_id, coupon_code,
          attribution_type, session_id, commission_rate_percent, commission_base, commission_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (store_id, order_id) DO NOTHING
        RETURNING id
      `,
      [
        attributionId,
        input.storeId,
        input.orderId,
        input.affiliateId,
        input.affiliateLinkId,
        input.couponId,
        input.couponCode,
        input.attributionType,
        input.sessionId,
        input.commissionRatePercent,
        input.commissionBase,
        input.commissionAmount,
      ],
    );

    if (!inserted.rows[0]) {
      return;
    }

    await db.query(
      `
        INSERT INTO affiliate_commissions (
          id, store_id, order_id, attribution_id, affiliate_id, status,
          commission_base, commission_amount, reversed_amount, net_amount
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, 0, $7)
        ON CONFLICT (store_id, order_id) DO NOTHING
      `,
      [
        uuidv4(),
        input.storeId,
        input.orderId,
        attributionId,
        input.affiliateId,
        input.commissionBase,
        input.commissionAmount,
      ],
    );
  }

  async findOrderState(
    storeId: string,
    orderId: string,
  ): Promise<{
    orderStatus: string;
    paymentStatus: string | null;
  } | null> {
    const result = await this.databaseService.db.query<{
      order_status: string;
      payment_status: string | null;
    }>(
      `
        SELECT o.status AS order_status, p.status AS payment_status
        FROM orders o
        LEFT JOIN payments p
          ON p.order_id = o.id
         AND p.store_id = o.store_id
        WHERE o.store_id = $1
          AND o.id = $2
        LIMIT 1
      `,
      [storeId, orderId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return { orderStatus: row.order_status, paymentStatus: row.payment_status };
  }

  async approveCommissionIfEligible(
    db: Queryable,
    storeId: string,
    orderId: string,
  ): Promise<void> {
    await db.query(
      `
        UPDATE affiliate_commissions c
        SET status = 'approved',
            approved_at = NOW(),
            updated_at = NOW()
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id AND p.store_id = o.store_id
        WHERE c.store_id = $1
          AND c.order_id = $2
          AND c.status = 'pending'
          AND o.id = c.order_id
          AND o.store_id = c.store_id
          AND o.status = 'completed'
          AND p.status = 'approved'
      `,
      [storeId, orderId],
    );
  }

  async reverseCommission(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      reason: string;
    },
  ): Promise<void> {
    await db.query(
      `
        UPDATE affiliate_commissions
        SET status = 'reversed',
            reversed_amount = commission_amount,
            net_amount = 0,
            reversed_at = NOW(),
            reversal_reason = $3,
            updated_at = NOW()
        WHERE store_id = $1
          AND order_id = $2
          AND status IN ('pending', 'approved', 'paid')
      `,
      [input.storeId, input.orderId, input.reason],
    );
  }

  async listCommissions(input: {
    storeId: string;
    affiliateId?: string;
    status?: AffiliateCommissionStatus;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: AffiliateCommissionRow[]; total: number }> {
    const values: unknown[] = [input.storeId];
    const where: string[] = ['c.store_id = $1'];

    if (input.affiliateId) {
      values.push(input.affiliateId);
      where.push(`c.affiliate_id = $${values.length}`);
    }

    if (input.status) {
      values.push(input.status);
      where.push(`c.status = $${values.length}`);
    }

    if (input.q?.trim()) {
      values.push(input.q.trim());
      const idx = values.length;
      where.push(
        `(o.order_code ILIKE '%' || $${idx} || '%' OR a.name ILIKE '%' || $${idx} || '%' OR COALESCE(a.email, '') ILIKE '%' || $${idx} || '%')`,
      );
    }

    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;
    const whereClause = where.join(' AND ');

    const rowsResult = await this.databaseService.db.query<AffiliateCommissionRow>(
      `
        SELECT
          c.id,
          c.order_id,
          o.order_code,
          c.affiliate_id,
          a.name AS affiliate_name,
          c.status,
          c.commission_base,
          c.commission_amount,
          c.reversed_amount,
          c.net_amount,
          c.approved_at,
          c.paid_at,
          c.reversed_at,
          c.created_at
        FROM affiliate_commissions c
        INNER JOIN affiliates a ON a.id = c.affiliate_id
        INNER JOIN orders o ON o.id = c.order_id
        WHERE ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      [...values, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM affiliate_commissions c
        INNER JOIN affiliates a ON a.id = c.affiliate_id
        INNER JOIN orders o ON o.id = c.order_id
        WHERE ${whereClause}
      `,
      values,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async listAllCommissionsForExport(storeId: string): Promise<AffiliateCommissionRow[]> {
    const result = await this.databaseService.db.query<AffiliateCommissionRow>(
      `
        SELECT
          c.id,
          c.order_id,
          o.order_code,
          c.affiliate_id,
          a.name AS affiliate_name,
          c.status,
          c.commission_base,
          c.commission_amount,
          c.reversed_amount,
          c.net_amount,
          c.approved_at,
          c.paid_at,
          c.reversed_at,
          c.created_at
        FROM affiliate_commissions c
        INNER JOIN affiliates a ON a.id = c.affiliate_id
        INNER JOIN orders o ON o.id = c.order_id
        WHERE c.store_id = $1
        ORDER BY c.created_at DESC
      `,
      [storeId],
    );
    return result.rows;
  }

  async createPayoutBatch(
    db: Queryable,
    input: {
      storeId: string;
      createdBy: string;
      note: string | null;
    },
  ): Promise<AffiliatePayoutBatchRow> {
    const batchId = uuidv4();

    const batch = await db.query<AffiliatePayoutBatchRow>(
      `
        INSERT INTO affiliate_payout_batches (
          id, store_id, status, currency_code, note, created_by
        )
        VALUES ($1, $2, 'finalized', 'YER', $3, $4)
        RETURNING id, status, currency_code, total_amount, items_count, note, paid_at, created_at
      `,
      [batchId, input.storeId, input.note, input.createdBy],
    );

    const settings = await this.getStoreSettings(input.storeId);
    const minPayout = Number(settings.affiliate_min_payout);

    const eligible = await db.query<{
      commission_id: string;
      affiliate_id: string;
      net_amount: string;
      affiliate_total: string;
    }>(
      `
        WITH eligible_affiliates AS (
          SELECT affiliate_id
          FROM affiliate_commissions
          WHERE store_id = $1
            AND status = 'approved'
            AND net_amount > 0
            AND id NOT IN (SELECT commission_id FROM affiliate_payout_items)
          GROUP BY affiliate_id
          HAVING SUM(net_amount) >= $2
        )
        SELECT c.id AS commission_id, c.affiliate_id, c.net_amount,
               SUM(c.net_amount) OVER (PARTITION BY c.affiliate_id) AS affiliate_total
        FROM affiliate_commissions c
        INNER JOIN eligible_affiliates ea ON ea.affiliate_id = c.affiliate_id
        WHERE c.store_id = $1
          AND c.status = 'approved'
          AND c.net_amount > 0
          AND c.id NOT IN (SELECT commission_id FROM affiliate_payout_items)
      `,
      [input.storeId, minPayout],
    );

    if (eligible.rows.length === 0) {
      return batch.rows[0] as AffiliatePayoutBatchRow;
    }

    let totalAmount = 0;
    for (const row of eligible.rows) {
      const amount = Number(row.net_amount);
      totalAmount += amount;
      await db.query(
        `
          INSERT INTO affiliate_payout_items (
            id, store_id, payout_batch_id, commission_id, affiliate_id, amount
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (commission_id) DO NOTHING
        `,
        [uuidv4(), input.storeId, batchId, row.commission_id, row.affiliate_id, amount],
      );
    }

    await db.query(
      `
        UPDATE affiliate_payout_batches
        SET total_amount = $3,
            items_count = (
              SELECT COUNT(*)
              FROM affiliate_payout_items
              WHERE payout_batch_id = $1
            ),
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
      `,
      [batchId, input.storeId, Number(totalAmount.toFixed(2))],
    );

    const updated = await db.query<AffiliatePayoutBatchRow>(
      `
        SELECT id, status, currency_code, total_amount, items_count, note, paid_at, created_at
        FROM affiliate_payout_batches
        WHERE id = $1
          AND store_id = $2
        LIMIT 1
      `,
      [batchId, input.storeId],
    );
    return updated.rows[0] as AffiliatePayoutBatchRow;
  }

  async listPayoutBatches(storeId: string): Promise<AffiliatePayoutBatchRow[]> {
    const result = await this.databaseService.db.query<AffiliatePayoutBatchRow>(
      `
        SELECT id, status, currency_code, total_amount, items_count, note, paid_at, created_at
        FROM affiliate_payout_batches
        WHERE store_id = $1
        ORDER BY created_at DESC
      `,
      [storeId],
    );
    return result.rows;
  }

  async markPayoutBatchPaid(
    db: Queryable,
    input: {
      storeId: string;
      batchId: string;
      note: string | null;
    },
  ): Promise<boolean> {
    const updated = await db.query(
      `
        UPDATE affiliate_payout_batches
        SET status = 'paid',
            paid_at = NOW(),
            note = COALESCE($3, note),
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
          AND status IN ('draft', 'finalized')
      `,
      [input.storeId, input.batchId, input.note],
    );

    if ((updated.rowCount ?? 0) === 0) {
      return false;
    }

    await db.query(
      `
        UPDATE affiliate_commissions c
        SET status = 'paid',
            paid_at = NOW(),
            updated_at = NOW()
        FROM affiliate_payout_items i
        WHERE i.payout_batch_id = $2
          AND i.store_id = $1
          AND c.id = i.commission_id
          AND c.store_id = i.store_id
          AND c.status = 'approved'
      `,
      [input.storeId, input.batchId],
    );

    return true;
  }
}
