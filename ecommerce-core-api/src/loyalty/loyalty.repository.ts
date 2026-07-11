import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { LoyaltyEntryType, LoyaltyRuleType } from './constants/loyalty.constants';

export interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface LoyaltyProgramRecord {
  id: string;
  store_id: string;
  is_enabled: boolean;
  redeem_rate_points: number;
  redeem_rate_amount: string;
  min_redeem_points: number;
  redeem_step_points: number;
  max_discount_percent: string;
}

export interface LoyaltyEarnRuleRecord {
  id: string;
  store_id: string;
  program_id: string;
  name: string;
  rule_type: LoyaltyRuleType;
  earn_rate: string;
  min_order_amount: string;
  is_active: boolean;
  priority: number;
}

export interface LoyaltyWalletRecord {
  id: string;
  store_id: string;
  customer_id: string;
  available_points: number;
  locked_points: number;
  lifetime_earned_points: number;
  lifetime_redeemed_points: number;
}

export interface LoyaltyLedgerRecord {
  id: string;
  store_id: string;
  customer_id: string;
  wallet_id: string;
  order_id: string | null;
  entry_type: LoyaltyEntryType;
  points_delta: number;
  amount_delta: string;
  balance_after: number;
  reference_entry_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_by_store_user_id: string | null;
  created_at: Date;
}

@Injectable()
export class LoyaltyRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findProgramByStoreId(storeId: string): Promise<LoyaltyProgramRecord | null> {
    const result = await this.databaseService.db.query<LoyaltyProgramRecord>(
      `
        SELECT id, store_id, is_enabled, redeem_rate_points, redeem_rate_amount,
               min_redeem_points, redeem_step_points, max_discount_percent
        FROM loyalty_programs
        WHERE store_id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0] ?? null;
  }

  async createDefaultProgram(storeId: string): Promise<LoyaltyProgramRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<LoyaltyProgramRecord>(
      `
        INSERT INTO loyalty_programs (
          id, store_id, is_enabled, redeem_rate_points, redeem_rate_amount,
          min_redeem_points, redeem_step_points, max_discount_percent
        )
        VALUES ($1, $2, FALSE, 100, 1, 100, 10, 50)
        ON CONFLICT (store_id) DO UPDATE SET updated_at = NOW()
        RETURNING id, store_id, is_enabled, redeem_rate_points, redeem_rate_amount,
                  min_redeem_points, redeem_step_points, max_discount_percent
      `,
      [id, storeId],
    );
    return result.rows[0] as LoyaltyProgramRecord;
  }

  async updateProgram(input: {
    storeId: string;
    isEnabled: boolean;
    redeemRatePoints: number;
    redeemRateAmount: number;
    minRedeemPoints: number;
    redeemStepPoints: number;
    maxDiscountPercent: number;
  }): Promise<LoyaltyProgramRecord> {
    const result = await this.databaseService.db.query<LoyaltyProgramRecord>(
      `
        UPDATE loyalty_programs
        SET is_enabled = $2,
            redeem_rate_points = $3,
            redeem_rate_amount = $4,
            min_redeem_points = $5,
            redeem_step_points = $6,
            max_discount_percent = $7,
            updated_at = NOW()
        WHERE store_id = $1
        RETURNING id, store_id, is_enabled, redeem_rate_points, redeem_rate_amount,
                  min_redeem_points, redeem_step_points, max_discount_percent
      `,
      [
        input.storeId,
        input.isEnabled,
        input.redeemRatePoints,
        input.redeemRateAmount,
        input.minRedeemPoints,
        input.redeemStepPoints,
        input.maxDiscountPercent,
      ],
    );
    return result.rows[0] as LoyaltyProgramRecord;
  }

  async listEarnRules(storeId: string): Promise<LoyaltyEarnRuleRecord[]> {
    const result = await this.databaseService.db.query<LoyaltyEarnRuleRecord>(
      `
        SELECT id, store_id, program_id, name, rule_type, earn_rate, min_order_amount, is_active, priority
        FROM loyalty_earn_rules
        WHERE store_id = $1
        ORDER BY priority ASC, created_at ASC
      `,
      [storeId],
    );
    return result.rows;
  }

  async replaceEarnRules(
    db: Queryable,
    storeId: string,
    programId: string,
    rules: Array<{
      name: string;
      ruleType: LoyaltyRuleType;
      earnRate: number;
      minOrderAmount: number;
      isActive: boolean;
      priority: number;
    }>,
  ): Promise<LoyaltyEarnRuleRecord[]> {
    await db.query(`DELETE FROM loyalty_earn_rules WHERE store_id = $1`, [storeId]);

    const inserted: LoyaltyEarnRuleRecord[] = [];
    for (const rule of rules) {
      const result = await db.query<LoyaltyEarnRuleRecord>(
        `
          INSERT INTO loyalty_earn_rules (
            id, store_id, program_id, name, rule_type, earn_rate, min_order_amount, is_active, priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, store_id, program_id, name, rule_type, earn_rate, min_order_amount, is_active, priority
        `,
        [
          uuidv4(),
          storeId,
          programId,
          rule.name,
          rule.ruleType,
          rule.earnRate,
          rule.minOrderAmount,
          rule.isActive,
          rule.priority,
        ],
      );
      inserted.push(result.rows[0] as LoyaltyEarnRuleRecord);
    }

    return inserted;
  }

  async findWallet(storeId: string, customerId: string): Promise<LoyaltyWalletRecord | null> {
    const result = await this.databaseService.db.query<LoyaltyWalletRecord>(
      `
        SELECT id, store_id, customer_id, available_points, locked_points, lifetime_earned_points, lifetime_redeemed_points
        FROM customer_loyalty_wallets
        WHERE store_id = $1
          AND customer_id = $2
        LIMIT 1
      `,
      [storeId, customerId],
    );
    return result.rows[0] ?? null;
  }

  async ensureWalletForUpdate(
    db: Queryable,
    storeId: string,
    customerId: string,
  ): Promise<LoyaltyWalletRecord> {
    await db.query(
      `
        INSERT INTO customer_loyalty_wallets (id, store_id, customer_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (store_id, customer_id) DO NOTHING
      `,
      [uuidv4(), storeId, customerId],
    );

    const result = await db.query<LoyaltyWalletRecord>(
      `
        SELECT id, store_id, customer_id, available_points, locked_points, lifetime_earned_points, lifetime_redeemed_points
        FROM customer_loyalty_wallets
        WHERE store_id = $1
          AND customer_id = $2
        FOR UPDATE
      `,
      [storeId, customerId],
    );
    return result.rows[0] as LoyaltyWalletRecord;
  }

  async updateWallet(
    db: Queryable,
    input: {
      walletId: string;
      availablePoints: number;
      lifetimeEarnedPoints: number;
      lifetimeRedeemedPoints: number;
    },
  ): Promise<void> {
    await db.query(
      `
        UPDATE customer_loyalty_wallets
        SET available_points = $2,
            lifetime_earned_points = $3,
            lifetime_redeemed_points = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.walletId,
        input.availablePoints,
        input.lifetimeEarnedPoints,
        input.lifetimeRedeemedPoints,
      ],
    );
  }

  async insertLedgerEntry(
    db: Queryable,
    input: {
      storeId: string;
      customerId: string;
      walletId: string;
      orderId: string | null;
      entryType: LoyaltyEntryType;
      pointsDelta: number;
      amountDelta: number;
      balanceAfter: number;
      referenceEntryId: string | null;
      reason: string | null;
      metadata: Record<string, unknown>;
      createdByStoreUserId: string | null;
    },
  ): Promise<LoyaltyLedgerRecord> {
    const result = await db.query<LoyaltyLedgerRecord>(
      `
        INSERT INTO loyalty_ledger_entries (
          id, store_id, customer_id, wallet_id, order_id, entry_type, points_delta,
          amount_delta, balance_after, reference_entry_id, reason, metadata, created_by_store_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
        RETURNING id, store_id, customer_id, wallet_id, order_id, entry_type, points_delta, amount_delta,
                  balance_after, reference_entry_id, reason, metadata, created_by_store_user_id, created_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.customerId,
        input.walletId,
        input.orderId,
        input.entryType,
        input.pointsDelta,
        input.amountDelta,
        input.balanceAfter,
        input.referenceEntryId,
        input.reason,
        JSON.stringify(input.metadata),
        input.createdByStoreUserId,
      ],
    );
    return result.rows[0] as LoyaltyLedgerRecord;
  }

  async listLedger(input: {
    storeId: string;
    customerId?: string;
    entryType?: LoyaltyEntryType;
    from?: Date;
    to?: Date;
  }): Promise<LoyaltyLedgerRecord[]> {
    const values: unknown[] = [input.storeId];
    const where: string[] = ['store_id = $1'];

    if (input.customerId) {
      values.push(input.customerId);
      where.push(`customer_id = $${values.length}`);
    }
    if (input.entryType) {
      values.push(input.entryType);
      where.push(`entry_type = $${values.length}`);
    }
    if (input.from) {
      values.push(input.from);
      where.push(`created_at >= $${values.length}`);
    }
    if (input.to) {
      values.push(input.to);
      where.push(`created_at <= $${values.length}`);
    }

    const result = await this.databaseService.db.query<LoyaltyLedgerRecord>(
      `
        SELECT id, store_id, customer_id, wallet_id, order_id, entry_type, points_delta, amount_delta,
               balance_after, reference_entry_id, reason, metadata, created_by_store_user_id, created_at
        FROM loyalty_ledger_entries
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT 500
      `,
      values,
    );
    return result.rows;
  }

  async findRedemptionEntryByOrder(
    db: Queryable,
    storeId: string,
    orderId: string,
  ): Promise<LoyaltyLedgerRecord | null> {
    const result = await db.query<LoyaltyLedgerRecord>(
      `
        SELECT id, store_id, customer_id, wallet_id, order_id, entry_type, points_delta, amount_delta,
               balance_after, reference_entry_id, reason, metadata, created_by_store_user_id, created_at
        FROM loyalty_ledger_entries
        WHERE store_id = $1
          AND order_id = $2
          AND entry_type = 'redeem'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async findEarnEntryByOrder(
    db: Queryable,
    storeId: string,
    orderId: string,
  ): Promise<LoyaltyLedgerRecord | null> {
    const result = await db.query<LoyaltyLedgerRecord>(
      `
        SELECT id, store_id, customer_id, wallet_id, order_id, entry_type, points_delta, amount_delta,
               balance_after, reference_entry_id, reason, metadata, created_by_store_user_id, created_at
        FROM loyalty_ledger_entries
        WHERE store_id = $1
          AND order_id = $2
          AND entry_type = 'earn'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async hasReverseForReference(
    db: Queryable,
    storeId: string,
    referenceEntryId: string,
  ): Promise<boolean> {
    const result = await db.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM loyalty_ledger_entries
          WHERE store_id = $1
            AND entry_type = 'reverse'
            AND reference_entry_id = $2
        ) AS exists
      `,
      [storeId, referenceEntryId],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async findOrderForLoyalty(
    storeId: string,
    orderId: string,
  ): Promise<{
    id: string;
    customer_id: string | null;
    status: string;
    subtotal: string;
    total: string;
    shipping_fee: string;
    discount_total: string;
    points_redeemed: number;
    points_discount_amount: string;
    points_earned: number;
  } | null> {
    const result = await this.databaseService.db.query<{
      id: string;
      customer_id: string | null;
      status: string;
      subtotal: string;
      total: string;
      shipping_fee: string;
      discount_total: string;
      points_redeemed: number;
      points_discount_amount: string;
      points_earned: number;
    }>(
      `
        SELECT id, customer_id, status, subtotal, total, shipping_fee, discount_total,
               points_redeemed, points_discount_amount, points_earned
        FROM orders
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async setOrderLoyalty(
    db: Queryable,
    input: {
      orderId: string;
      storeId: string;
      pointsRedeemed: number;
      pointsDiscountAmount: number;
      pointsEarned?: number;
    },
  ): Promise<void> {
    await db.query(
      `
        UPDATE orders
        SET points_redeemed = $3,
            points_discount_amount = $4,
            points_earned = COALESCE($5, points_earned),
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
      `,
      [
        input.orderId,
        input.storeId,
        input.pointsRedeemed,
        input.pointsDiscountAmount,
        input.pointsEarned ?? null,
      ],
    );
  }

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
}
