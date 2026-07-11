import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface AbandonableCartSnapshotRecord {
  cart_id: string;
  store_id: string;
  store_slug: string;
  store_name: string;
  currency_code: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  items_count: number;
  cart_total: string;
  cart_data: Record<string, unknown>;
  expires_at: Date;
}

export interface AbandonedCartRecord {
  id: string;
  store_id: string;
  cart_id: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  cart_data: Record<string, unknown>;
  cart_total: string;
  items_count: number;
  recovery_token: string;
  recovery_sent_at: Date | null;
  recovered_at: Date | null;
  recovered_order_id: string | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DispatchableAbandonedCartRecord {
  abandoned_cart_id: string;
  store_id: string;
  store_slug: string;
  store_name: string;
  currency_code: string;
  cart_id: string | null;
  customer_email: string;
  customer_phone: string | null;
  cart_total: string;
  items_count: number;
  recovery_token: string;
  cart_data: Record<string, unknown>;
  expires_at: Date;
}

export interface AbandonedCartRecoveryTargetRecord {
  abandoned_cart_id: string;
  store_id: string;
  store_slug: string;
  cart_id: string | null;
  recovery_token: string;
  expires_at: Date;
  recovered_at: Date | null;
}

export interface ManagedAbandonedCartRow {
  id: string;
  cart_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  cart_total: string;
  items_count: number;
  recovery_sent_at: Date | null;
  recovered_at: Date | null;
  recovered_order_id: string | null;
  expires_at: Date;
  created_at: Date;
}

export type ManagedAbandonedCartStatus = 'ready' | 'sent' | 'recovered' | 'expired';

@Injectable()
export class AbandonedCartsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAbandonableCarts(input: {
    inactivityMinutes: number;
    limit: number;
  }): Promise<AbandonableCartSnapshotRecord[]> {
    const result = await this.databaseService.db.query<AbandonableCartSnapshotRecord>(
      `
        SELECT
          c.id AS cart_id,
          c.store_id,
          s.slug AS store_slug,
          s.name AS store_name,
          s.currency_code,
          c.customer_id,
          cu.email AS customer_email,
          cu.phone AS customer_phone,
          COUNT(ci.id)::int AS items_count,
          COALESCE(SUM(ci.quantity * ci.unit_price), 0)::numeric(12, 2)::text AS cart_total,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'productId', ci.product_id,
                'variantId', ci.variant_id,
                'quantity', ci.quantity,
                'unitPrice', ci.unit_price,
                'title', p.title,
                'sku', pv.sku
              )
              ORDER BY ci.created_at ASC
            ),
            '[]'::jsonb
          ) AS cart_data,
          c.expires_at
        FROM carts c
        INNER JOIN stores s ON s.id = c.store_id
        INNER JOIN cart_items ci
          ON ci.cart_id = c.id
         AND ci.store_id = c.store_id
        INNER JOIN products p ON p.id = ci.product_id
        INNER JOIN product_variants pv ON pv.id = ci.variant_id
        LEFT JOIN customers cu ON cu.id = c.customer_id
        LEFT JOIN abandoned_carts ac
          ON ac.store_id = c.store_id
         AND ac.cart_id = c.id
         AND ac.recovered_at IS NULL
         AND ac.expires_at > NOW()
        WHERE c.status = 'open'
          AND c.updated_at <= NOW() - ($1::text || ' minutes')::interval
          AND c.expires_at > NOW()
          AND ac.id IS NULL
        GROUP BY
          c.id,
          c.store_id,
          s.slug,
          s.name,
          s.currency_code,
          c.customer_id,
          cu.email,
          cu.phone,
          c.expires_at
        ORDER BY c.expires_at ASC
        LIMIT $2
      `,
      [String(input.inactivityMinutes), input.limit],
    );

    return result.rows;
  }

  async upsertAbandonedCart(input: {
    storeId: string;
    cartId: string;
    customerId: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    cartData: Record<string, unknown>;
    cartTotal: number;
    itemsCount: number;
    expiresAt: Date;
  }): Promise<AbandonedCartRecord> {
    const result = await this.databaseService.db.query<AbandonedCartRecord>(
      `
        INSERT INTO abandoned_carts (
          id,
          store_id,
          cart_id,
          customer_id,
          customer_email,
          customer_phone,
          cart_data,
          cart_total,
          items_count,
          recovery_token,
          expires_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8,
          $9,
          $10,
          $11,
          NOW(),
          NOW()
        )
        ON CONFLICT (store_id, cart_id)
        WHERE cart_id IS NOT NULL
        DO UPDATE SET
          customer_id = EXCLUDED.customer_id,
          customer_email = EXCLUDED.customer_email,
          customer_phone = EXCLUDED.customer_phone,
          cart_data = EXCLUDED.cart_data,
          cart_total = EXCLUDED.cart_total,
          items_count = EXCLUDED.items_count,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING
          id,
          store_id,
          cart_id,
          customer_id,
          customer_email,
          customer_phone,
          cart_data,
          cart_total,
          items_count,
          recovery_token,
          recovery_sent_at,
          recovered_at,
          recovered_order_id,
          expires_at,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.cartId,
        input.customerId,
        input.customerEmail,
        input.customerPhone,
        JSON.stringify(input.cartData),
        input.cartTotal,
        input.itemsCount,
        uuidv4(),
        input.expiresAt,
      ],
    );

    return result.rows[0] as AbandonedCartRecord;
  }

  async markCartAsAbandoned(storeId: string, cartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE carts
        SET status = 'abandoned',
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
          AND status = 'open'
      `,
      [storeId, cartId],
    );
  }

  async listDispatchableAbandonedCarts(input: {
    cooldownHours: number;
    limit: number;
  }): Promise<DispatchableAbandonedCartRecord[]> {
    const result = await this.databaseService.db.query<DispatchableAbandonedCartRecord>(
      `
        SELECT
          ac.id AS abandoned_cart_id,
          ac.store_id,
          s.slug AS store_slug,
          s.name AS store_name,
          s.currency_code,
          ac.cart_id,
          ac.customer_email,
          ac.customer_phone,
          ac.cart_total::text,
          ac.items_count,
          ac.recovery_token,
          ac.cart_data,
          ac.expires_at
        FROM abandoned_carts ac
        INNER JOIN stores s ON s.id = ac.store_id
        WHERE ac.recovered_at IS NULL
          AND ac.expires_at > NOW()
          AND ac.customer_email IS NOT NULL
          AND BTRIM(ac.customer_email) <> ''
          AND (
            ac.recovery_sent_at IS NULL
            OR ac.recovery_sent_at < NOW() - ($1::text || ' hours')::interval
          )
        ORDER BY ac.created_at ASC
        LIMIT $2
      `,
      [String(input.cooldownHours), input.limit],
    );

    return result.rows;
  }

  async markRecoveryEmailSent(abandonedCartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE abandoned_carts
        SET recovery_sent_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [abandonedCartId],
    );
  }

  async insertReminder(input: {
    abandonedCartId: string;
    reminderType: 'email' | 'sms';
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO abandoned_cart_reminders (
          id,
          abandoned_cart_id,
          reminder_type,
          sent_at
        )
        VALUES ($1, $2, $3, NOW())
      `,
      [uuidv4(), input.abandonedCartId, input.reminderType],
    );
  }

  async findRecoveryTargetByToken(
    token: string,
  ): Promise<AbandonedCartRecoveryTargetRecord | null> {
    const result = await this.databaseService.db.query<AbandonedCartRecoveryTargetRecord>(
      `
        SELECT
          ac.id AS abandoned_cart_id,
          ac.store_id,
          s.slug AS store_slug,
          ac.cart_id,
          ac.recovery_token,
          ac.expires_at,
          ac.recovered_at
        FROM abandoned_carts ac
        INNER JOIN stores s ON s.id = ac.store_id
        WHERE ac.recovery_token = $1
        LIMIT 1
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  async markLatestReminderClicked(abandonedCartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE abandoned_cart_reminders
        SET clicked_at = COALESCE(clicked_at, NOW())
        WHERE id = (
          SELECT id
          FROM abandoned_cart_reminders
          WHERE abandoned_cart_id = $1
            AND reminder_type = 'email'
          ORDER BY sent_at DESC
          LIMIT 1
        )
      `,
      [abandonedCartId],
    );
  }

  async markLatestReminderOpened(abandonedCartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE abandoned_cart_reminders
        SET opened_at = COALESCE(opened_at, NOW())
        WHERE id = (
          SELECT id
          FROM abandoned_cart_reminders
          WHERE abandoned_cart_id = $1
            AND reminder_type = 'email'
          ORDER BY sent_at DESC
          LIMIT 1
        )
      `,
      [abandonedCartId],
    );
  }

  async reopenCart(storeId: string, cartId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE carts
        SET status = 'open',
            updated_at = NOW(),
            expires_at = NOW() + INTERVAL '7 days'
        WHERE store_id = $1
          AND id = $2
          AND status IN ('open', 'abandoned')
      `,
      [storeId, cartId],
    );
  }

  async attachRecoveredOrder(input: {
    storeId: string;
    cartId: string;
    orderId: string;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE abandoned_carts
        SET recovered_at = NOW(),
            recovered_order_id = $3,
            updated_at = NOW()
        WHERE store_id = $1
          AND cart_id = $2
          AND recovered_at IS NULL
          AND expires_at > NOW()
      `,
      [input.storeId, input.cartId, input.orderId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listManagedAbandonedCarts(input: {
    storeId: string;
    status: ManagedAbandonedCartStatus | null;
    q: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: ManagedAbandonedCartRow[]; total: number }> {
    const where: string[] = ['ac.store_id = $1'];
    const values: unknown[] = [input.storeId];
    let cursor = 2;

    if (input.status === 'ready') {
      where.push('ac.recovered_at IS NULL');
      where.push('ac.expires_at > NOW()');
      where.push('ac.recovery_sent_at IS NULL');
    } else if (input.status === 'sent') {
      where.push('ac.recovered_at IS NULL');
      where.push('ac.expires_at > NOW()');
      where.push('ac.recovery_sent_at IS NOT NULL');
    } else if (input.status === 'recovered') {
      where.push('ac.recovered_at IS NOT NULL');
    } else if (input.status === 'expired') {
      where.push('ac.recovered_at IS NULL');
      where.push('ac.expires_at <= NOW()');
    }

    if (input.q) {
      where.push(
        `(BTRIM(COALESCE(c.full_name, '')) ILIKE $${cursor}
          OR BTRIM(COALESCE(ac.customer_email, '')) ILIKE $${cursor}
          OR BTRIM(COALESCE(ac.customer_phone, '')) ILIKE $${cursor})`,
      );
      values.push(`%${input.q}%`);
      cursor += 1;
    }

    const whereSql = where.join(' AND ');

    const rowsResult = await this.databaseService.db.query<ManagedAbandonedCartRow>(
      `
        SELECT
          ac.id,
          ac.cart_id,
          ac.customer_id,
          c.full_name AS customer_name,
          ac.customer_email,
          ac.customer_phone,
          ac.cart_total::text,
          ac.items_count,
          ac.recovery_sent_at,
          ac.recovered_at,
          ac.recovered_order_id,
          ac.expires_at,
          ac.created_at
        FROM abandoned_carts ac
        LEFT JOIN customers c ON c.id = ac.customer_id
        WHERE ${whereSql}
        ORDER BY ac.created_at DESC
        LIMIT $${cursor} OFFSET $${cursor + 1}
      `,
      [...values, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM abandoned_carts ac
        LEFT JOIN customers c ON c.id = ac.customer_id
        WHERE ${whereSql}
      `,
      values,
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
  }

  async findDispatchableAbandonedCartById(
    storeId: string,
    abandonedCartId: string,
  ): Promise<DispatchableAbandonedCartRecord | null> {
    const result = await this.databaseService.db.query<DispatchableAbandonedCartRecord>(
      `
        SELECT
          ac.id AS abandoned_cart_id,
          ac.store_id,
          s.slug AS store_slug,
          s.name AS store_name,
          s.currency_code,
          ac.cart_id,
          ac.customer_email,
          ac.customer_phone,
          ac.cart_total::text,
          ac.items_count,
          ac.recovery_token,
          ac.cart_data,
          ac.expires_at
        FROM abandoned_carts ac
        INNER JOIN stores s ON s.id = ac.store_id
        WHERE ac.store_id = $1
          AND ac.id = $2
          AND ac.recovered_at IS NULL
          AND ac.expires_at > NOW()
          AND ac.customer_email IS NOT NULL
          AND BTRIM(ac.customer_email) <> ''
        LIMIT 1
      `,
      [storeId, abandonedCartId],
    );

    return result.rows[0] ?? null;
  }
}
