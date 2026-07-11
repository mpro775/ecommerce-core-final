import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type { CreateLoyaltyAdjustmentDto } from './dto/create-loyalty-adjustment.dto';
import type { ListLoyaltyLedgerQueryDto } from './dto/list-loyalty-ledger-query.dto';
import type {
  LoyaltyEarnRuleInputDto,
  UpdateLoyaltyRulesDto,
} from './dto/update-loyalty-rules.dto';
import type { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';
import {
  LoyaltyRepository,
  type LoyaltyLedgerRecord,
  type LoyaltyProgramRecord,
  type LoyaltyWalletRecord,
  type Queryable,
} from './loyalty.repository';

export interface LoyaltySettingsResponse {
  isEnabled: boolean;
  redeemRatePoints: number;
  redeemRateAmount: number;
  minRedeemPoints: number;
  redeemStepPoints: number;
  maxDiscountPercent: number;
}

export interface LoyaltyRuleResponse {
  id: string;
  name: string;
  ruleType: 'order_percent';
  earnRate: number;
  minOrderAmount: number;
  isActive: boolean;
  priority: number;
}

export interface LoyaltyWalletResponse {
  customerId: string;
  availablePoints: number;
  lockedPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
}

export interface LoyaltyLedgerEntryResponse {
  id: string;
  customerId: string;
  orderId: string | null;
  entryType: 'earn' | 'redeem' | 'adjust' | 'reverse';
  pointsDelta: number;
  amountDelta: number;
  balanceAfter: number;
  referenceEntryId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdByStoreUserId: string | null;
  createdAt: Date;
}

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly loyaltyRepository: LoyaltyRepository,
    private readonly auditService: AuditService,
    private readonly webhooksService: WebhooksService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
  ) {}

  async getSettings(currentUser: AuthUser): Promise<LoyaltySettingsResponse> {
    const program = await this.ensureProgram(currentUser.storeId);
    return this.mapProgram(program);
  }

  async getSettingsByStoreId(storeId: string): Promise<LoyaltySettingsResponse> {
    if (!(await this.storeCapabilitiesService.isFeatureEnabled(storeId, 'loyalty_program'))) {
      return {
        isEnabled: false,
        redeemRatePoints: 100,
        redeemRateAmount: 1,
        minRedeemPoints: 100,
        redeemStepPoints: 10,
        maxDiscountPercent: 50,
      };
    }
    const program = await this.ensureProgram(storeId);
    return this.mapProgram(program);
  }

  async updateSettings(
    currentUser: AuthUser,
    input: UpdateLoyaltySettingsDto,
    context: RequestContextData,
  ): Promise<LoyaltySettingsResponse> {
    const existing = await this.ensureProgram(currentUser.storeId);
    const updated = await this.loyaltyRepository.updateProgram({
      storeId: currentUser.storeId,
      isEnabled: input.isEnabled ?? existing.is_enabled,
      redeemRatePoints: input.redeemRatePoints ?? existing.redeem_rate_points,
      redeemRateAmount: input.redeemRateAmount ?? Number(existing.redeem_rate_amount),
      minRedeemPoints: input.minRedeemPoints ?? existing.min_redeem_points,
      redeemStepPoints: input.redeemStepPoints ?? existing.redeem_step_points,
      maxDiscountPercent: input.maxDiscountPercent ?? Number(existing.max_discount_percent),
    });

    await this.auditService.log({
      action: 'loyalty.settings_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'loyalty_program',
      targetId: updated.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });

    return this.mapProgram(updated);
  }

  async getRules(currentUser: AuthUser): Promise<LoyaltyRuleResponse[]> {
    await this.ensureProgram(currentUser.storeId);
    const rules = await this.loyaltyRepository.listEarnRules(currentUser.storeId);
    if (rules.length > 0) {
      return rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        ruleType: rule.rule_type,
        earnRate: Number(rule.earn_rate),
        minOrderAmount: Number(rule.min_order_amount),
        isActive: rule.is_active,
        priority: rule.priority,
      }));
    }

    const created = await this.loyaltyRepository.withTransaction(async (db) => {
      const program = await this.ensureProgramInTransaction(db, currentUser.storeId);
      return this.loyaltyRepository.replaceEarnRules(db, currentUser.storeId, program.id, [
        {
          name: 'Default earn rule',
          ruleType: 'order_percent',
          earnRate: 1,
          minOrderAmount: 0,
          isActive: true,
          priority: 100,
        },
      ]);
    });

    return created.map((rule) => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.rule_type,
      earnRate: Number(rule.earn_rate),
      minOrderAmount: Number(rule.min_order_amount),
      isActive: rule.is_active,
      priority: rule.priority,
    }));
  }

  async getRulesByStoreId(storeId: string): Promise<LoyaltyRuleResponse[]> {
    await this.ensureProgram(storeId);
    const rules = await this.loyaltyRepository.listEarnRules(storeId);
    if (rules.length > 0) {
      return rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        ruleType: rule.rule_type,
        earnRate: Number(rule.earn_rate),
        minOrderAmount: Number(rule.min_order_amount),
        isActive: rule.is_active,
        priority: rule.priority,
      }));
    }

    const created = await this.loyaltyRepository.withTransaction(async (db) => {
      const program = await this.ensureProgramInTransaction(db, storeId);
      return this.loyaltyRepository.replaceEarnRules(db, storeId, program.id, [
        {
          name: 'Default earn rule',
          ruleType: 'order_percent',
          earnRate: 1,
          minOrderAmount: 0,
          isActive: true,
          priority: 100,
        },
      ]);
    });

    return created.map((rule) => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.rule_type,
      earnRate: Number(rule.earn_rate),
      minOrderAmount: Number(rule.min_order_amount),
      isActive: rule.is_active,
      priority: rule.priority,
    }));
  }

  async updateRules(
    currentUser: AuthUser,
    input: UpdateLoyaltyRulesDto,
    context: RequestContextData,
  ): Promise<LoyaltyRuleResponse[]> {
    const updated = await this.loyaltyRepository.withTransaction(async (db) => {
      const program = await this.ensureProgramInTransaction(db, currentUser.storeId);
      return this.loyaltyRepository.replaceEarnRules(
        db,
        currentUser.storeId,
        program.id,
        this.normalizeRulesInput(input.rules),
      );
    });

    await this.auditService.log({
      action: 'loyalty.rules_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'loyalty_program',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId, count: updated.length } : {},
    });

    return updated.map((rule) => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.rule_type,
      earnRate: Number(rule.earn_rate),
      minOrderAmount: Number(rule.min_order_amount),
      isActive: rule.is_active,
      priority: rule.priority,
    }));
  }

  async getWalletForCustomer(
    currentUser: AuthUser,
    customerId: string,
  ): Promise<LoyaltyWalletResponse> {
    const wallet = await this.ensureWallet(currentUser.storeId, customerId);
    return this.mapWallet(wallet);
  }

  async getWalletForCurrentCustomer(
    customerId: string,
    storeId: string,
  ): Promise<LoyaltyWalletResponse> {
    const wallet = await this.ensureWallet(storeId, customerId);
    return this.mapWallet(wallet);
  }

  async listLedgerForStore(
    currentUser: AuthUser,
    query: ListLoyaltyLedgerQueryDto,
  ): Promise<LoyaltyLedgerEntryResponse[]> {
    const rows = await this.loyaltyRepository.listLedger({
      storeId: currentUser.storeId,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
    });
    return rows.map((row) => this.mapLedger(row));
  }

  async listLedgerForCurrentCustomer(
    customerId: string,
    storeId: string,
    query: ListLoyaltyLedgerQueryDto,
  ): Promise<LoyaltyLedgerEntryResponse[]> {
    const rows = await this.loyaltyRepository.listLedger({
      storeId,
      customerId,
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
    });
    return rows.map((row) => this.mapLedger(row));
  }

  async createAdjustment(
    currentUser: AuthUser,
    customerId: string,
    input: CreateLoyaltyAdjustmentDto,
    context: RequestContextData,
  ): Promise<LoyaltyWalletResponse> {
    if (currentUser.role !== 'owner' && !currentUser.permissions.includes('loyalty:adjust')) {
      throw new ForbiddenException('Missing loyalty:adjust permission');
    }

    const pointsDelta = Math.trunc(input.pointsDelta);
    if (pointsDelta === 0) {
      throw new BadRequestException('pointsDelta cannot be zero');
    }

    const wallet = await this.loyaltyRepository.withTransaction(async (db) => {
      const current = await this.loyaltyRepository.ensureWalletForUpdate(
        db,
        currentUser.storeId,
        customerId,
      );
      const nextBalance = current.available_points + pointsDelta;
      if (nextBalance < 0) {
        throw new BadRequestException('Insufficient points balance for negative adjustment');
      }

      const lifetimeEarned = current.lifetime_earned_points + (pointsDelta > 0 ? pointsDelta : 0);
      const lifetimeRedeemed =
        current.lifetime_redeemed_points + (pointsDelta < 0 ? Math.abs(pointsDelta) : 0);
      await this.loyaltyRepository.updateWallet(db, {
        walletId: current.id,
        availablePoints: nextBalance,
        lifetimeEarnedPoints: lifetimeEarned,
        lifetimeRedeemedPoints: lifetimeRedeemed,
      });

      await this.loyaltyRepository.insertLedgerEntry(db, {
        storeId: currentUser.storeId,
        customerId,
        walletId: current.id,
        orderId: null,
        entryType: 'adjust',
        pointsDelta,
        amountDelta: 0,
        balanceAfter: nextBalance,
        referenceEntryId: null,
        reason: input.reason?.trim() ?? null,
        metadata: { source: 'merchant_adjustment' },
        createdByStoreUserId: currentUser.id,
      });

      return {
        ...current,
        available_points: nextBalance,
        lifetime_earned_points: lifetimeEarned,
        lifetime_redeemed_points: lifetimeRedeemed,
      };
    });

    await this.auditService.log({
      action: 'loyalty.adjustment_created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'customer',
      targetId: customerId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        pointsDelta,
      },
    });

    await this.webhooksService.dispatchEvent(currentUser.storeId, 'loyalty.adjustment.created', {
      customerId,
      pointsDelta,
    });
    return this.mapWallet(wallet);
  }

  computeRedeemEstimate(input: {
    program: LoyaltyProgramRecord;
    availablePoints: number;
    requestedPoints: number;
    totalBeforeDiscount: number;
  }): {
    pointsRedeemed: number;
    discountAmount: number;
  } {
    if (input.requestedPoints <= 0 || input.availablePoints <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    if (input.requestedPoints < input.program.min_redeem_points) {
      throw new BadRequestException(`Minimum redeem points is ${input.program.min_redeem_points}`);
    }

    const rawPoints = Math.min(input.requestedPoints, input.availablePoints);
    const steppedPoints = rawPoints - (rawPoints % input.program.redeem_step_points);
    if (steppedPoints <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    const maxByPercent = Number(
      ((input.totalBeforeDiscount * Number(input.program.max_discount_percent)) / 100).toFixed(2),
    );
    const convertedAmount = Number(
      (
        (steppedPoints / input.program.redeem_rate_points) *
        Number(input.program.redeem_rate_amount)
      ).toFixed(2),
    );
    const appliedAmount = Math.min(maxByPercent, convertedAmount, input.totalBeforeDiscount);
    if (appliedAmount <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    const pointsForAppliedAmount = Math.floor(
      (appliedAmount / Number(input.program.redeem_rate_amount)) * input.program.redeem_rate_points,
    );
    const normalizedPoints =
      pointsForAppliedAmount - (pointsForAppliedAmount % input.program.redeem_step_points);
    if (normalizedPoints < input.program.min_redeem_points) {
      throw new BadRequestException(`Minimum redeem points is ${input.program.min_redeem_points}`);
    }

    const finalDiscount = Number(
      (
        (normalizedPoints / input.program.redeem_rate_points) *
        Number(input.program.redeem_rate_amount)
      ).toFixed(2),
    );

    return {
      pointsRedeemed: Math.min(normalizedPoints, steppedPoints),
      discountAmount: Math.min(finalDiscount, input.totalBeforeDiscount, maxByPercent),
    };
  }

  async applyRedemptionToOrderInTransaction(
    db: Queryable,
    input: {
      storeId: string;
      customerId: string;
      orderId: string;
      pointsToRedeem: number;
      totalBeforeDiscount: number;
      createdByStoreUserId: string | null;
    },
  ): Promise<{ pointsRedeemed: number; discountAmount: number }> {
    if (input.pointsToRedeem <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    await this.storeCapabilitiesService.assertFeatureEnabled(input.storeId, 'loyalty_program');
    const program = await this.ensureProgram(input.storeId);
    if (!program.is_enabled) {
      throw new BadRequestException('Loyalty program is not enabled');
    }

    const wallet = await this.loyaltyRepository.ensureWalletForUpdate(
      db,
      input.storeId,
      input.customerId,
    );

    const estimate = this.computeRedeemEstimate({
      program,
      availablePoints: wallet.available_points,
      requestedPoints: input.pointsToRedeem,
      totalBeforeDiscount: input.totalBeforeDiscount,
    });
    if (estimate.pointsRedeemed <= 0 || estimate.discountAmount <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    const nextBalance = wallet.available_points - estimate.pointsRedeemed;
    await this.loyaltyRepository.updateWallet(db, {
      walletId: wallet.id,
      availablePoints: nextBalance,
      lifetimeEarnedPoints: wallet.lifetime_earned_points,
      lifetimeRedeemedPoints: wallet.lifetime_redeemed_points + estimate.pointsRedeemed,
    });

    await this.loyaltyRepository.insertLedgerEntry(db, {
      storeId: input.storeId,
      customerId: input.customerId,
      walletId: wallet.id,
      orderId: input.orderId,
      entryType: 'redeem',
      pointsDelta: -estimate.pointsRedeemed,
      amountDelta: -estimate.discountAmount,
      balanceAfter: nextBalance,
      referenceEntryId: null,
      reason: 'Points redeemed during checkout',
      metadata: { source: 'checkout' },
      createdByStoreUserId: input.createdByStoreUserId,
    });

    await this.loyaltyRepository.setOrderLoyalty(db, {
      orderId: input.orderId,
      storeId: input.storeId,
      pointsRedeemed: estimate.pointsRedeemed,
      pointsDiscountAmount: estimate.discountAmount,
    });

    return estimate;
  }

  async handleOrderCompletedInTransaction(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      createdByStoreUserId: string | null;
    },
  ): Promise<void> {
    if (!(await this.storeCapabilitiesService.isFeatureEnabled(input.storeId, 'loyalty_program'))) {
      return;
    }

    const program = await this.ensureProgram(input.storeId);
    if (!program.is_enabled) {
      return;
    }

    const order = await this.loyaltyRepository.findOrderForLoyalty(input.storeId, input.orderId);
    if (!order || !order.customer_id) {
      return;
    }

    const existingEarn = await this.loyaltyRepository.findEarnEntryByOrder(
      db,
      input.storeId,
      input.orderId,
    );
    if (existingEarn) {
      return;
    }

    const rules = await this.loyaltyRepository.listEarnRules(input.storeId);
    const activeRules = rules.filter((rule) => rule.is_active);
    if (activeRules.length === 0) {
      return;
    }

    const subtotal = Number(order.subtotal);
    const matchedRule =
      activeRules
        .sort((a, b) => a.priority - b.priority)
        .find((rule) => subtotal >= Number(rule.min_order_amount)) ?? null;
    if (!matchedRule) {
      return;
    }

    const points = Math.floor((subtotal * Number(matchedRule.earn_rate)) / 100);
    if (points <= 0) {
      return;
    }

    const wallet = await this.loyaltyRepository.ensureWalletForUpdate(
      db,
      input.storeId,
      order.customer_id,
    );
    const nextBalance = wallet.available_points + points;
    await this.loyaltyRepository.updateWallet(db, {
      walletId: wallet.id,
      availablePoints: nextBalance,
      lifetimeEarnedPoints: wallet.lifetime_earned_points + points,
      lifetimeRedeemedPoints: wallet.lifetime_redeemed_points,
    });

    await this.loyaltyRepository.insertLedgerEntry(db, {
      storeId: input.storeId,
      customerId: order.customer_id,
      walletId: wallet.id,
      orderId: input.orderId,
      entryType: 'earn',
      pointsDelta: points,
      amountDelta: 0,
      balanceAfter: nextBalance,
      referenceEntryId: null,
      reason: 'Points earned after order completion',
      metadata: { source: 'order_completed', ruleId: matchedRule.id },
      createdByStoreUserId: input.createdByStoreUserId,
    });

    await this.loyaltyRepository.setOrderLoyalty(db, {
      orderId: input.orderId,
      storeId: input.storeId,
      pointsRedeemed: order.points_redeemed,
      pointsDiscountAmount: Number(order.points_discount_amount),
      pointsEarned: points,
    });
  }

  async handleOrderCancelledOrReturnedInTransaction(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      createdByStoreUserId: string | null;
    },
  ): Promise<void> {
    const order = await this.loyaltyRepository.findOrderForLoyalty(input.storeId, input.orderId);
    if (!order || !order.customer_id) {
      return;
    }

    const redemption = await this.loyaltyRepository.findRedemptionEntryByOrder(
      db,
      input.storeId,
      input.orderId,
    );
    if (redemption) {
      const alreadyReversed = await this.loyaltyRepository.hasReverseForReference(
        db,
        input.storeId,
        redemption.id,
      );
      if (!alreadyReversed) {
        const wallet = await this.loyaltyRepository.ensureWalletForUpdate(
          db,
          input.storeId,
          order.customer_id,
        );
        const pointsToReturn = Math.abs(redemption.points_delta);
        const nextBalance = wallet.available_points + pointsToReturn;
        await this.loyaltyRepository.updateWallet(db, {
          walletId: wallet.id,
          availablePoints: nextBalance,
          lifetimeEarnedPoints: wallet.lifetime_earned_points,
          lifetimeRedeemedPoints: Math.max(wallet.lifetime_redeemed_points - pointsToReturn, 0),
        });
        await this.loyaltyRepository.insertLedgerEntry(db, {
          storeId: input.storeId,
          customerId: order.customer_id,
          walletId: wallet.id,
          orderId: input.orderId,
          entryType: 'reverse',
          pointsDelta: pointsToReturn,
          amountDelta: Math.abs(Number(redemption.amount_delta)),
          balanceAfter: nextBalance,
          referenceEntryId: redemption.id,
          reason: 'Reversed points redemption due to cancellation/return',
          metadata: { source: 'order_cancel_or_return' },
          createdByStoreUserId: input.createdByStoreUserId,
        });
      }
    }

    const earn = await this.loyaltyRepository.findEarnEntryByOrder(
      db,
      input.storeId,
      input.orderId,
    );
    if (earn) {
      const alreadyReversed = await this.loyaltyRepository.hasReverseForReference(
        db,
        input.storeId,
        earn.id,
      );
      if (!alreadyReversed) {
        const wallet = await this.loyaltyRepository.ensureWalletForUpdate(
          db,
          input.storeId,
          order.customer_id,
        );
        const pointsToRemove = Math.abs(earn.points_delta);
        const nextBalance = Math.max(wallet.available_points - pointsToRemove, 0);
        await this.loyaltyRepository.updateWallet(db, {
          walletId: wallet.id,
          availablePoints: nextBalance,
          lifetimeEarnedPoints: Math.max(wallet.lifetime_earned_points - pointsToRemove, 0),
          lifetimeRedeemedPoints: wallet.lifetime_redeemed_points,
        });
        await this.loyaltyRepository.insertLedgerEntry(db, {
          storeId: input.storeId,
          customerId: order.customer_id,
          walletId: wallet.id,
          orderId: input.orderId,
          entryType: 'reverse',
          pointsDelta: -pointsToRemove,
          amountDelta: 0,
          balanceAfter: nextBalance,
          referenceEntryId: earn.id,
          reason: 'Reversed earned points due to cancellation/return',
          metadata: { source: 'order_cancel_or_return' },
          createdByStoreUserId: input.createdByStoreUserId,
        });
      }
    }
  }

  async publishWalletUpdated(storeId: string, customerId: string): Promise<void> {
    if (!(await this.storeCapabilitiesService.isFeatureEnabled(storeId, 'loyalty_program'))) {
      return;
    }

    const wallet = await this.ensureWallet(storeId, customerId);
    await this.webhooksService.dispatchEvent(storeId, 'loyalty.wallet.updated', {
      customerId: wallet.customer_id,
      availablePoints: wallet.available_points,
      lifetimeEarnedPoints: wallet.lifetime_earned_points,
      lifetimeRedeemedPoints: wallet.lifetime_redeemed_points,
    });
  }

  private async ensureProgram(storeId: string): Promise<LoyaltyProgramRecord> {
    const existing = await this.loyaltyRepository.findProgramByStoreId(storeId);
    if (existing) {
      return existing;
    }
    return this.loyaltyRepository.createDefaultProgram(storeId);
  }

  private async ensureProgramInTransaction(
    db: Queryable,
    storeId: string,
  ): Promise<LoyaltyProgramRecord> {
    const existing = await db.query<LoyaltyProgramRecord>(
      `
        SELECT id, store_id, is_enabled, redeem_rate_points, redeem_rate_amount,
               min_redeem_points, redeem_step_points, max_discount_percent
        FROM loyalty_programs
        WHERE store_id = $1
        LIMIT 1
      `,
      [storeId],
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const created = await db.query<LoyaltyProgramRecord>(
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
      [crypto.randomUUID(), storeId],
    );
    return created.rows[0] as LoyaltyProgramRecord;
  }

  private async ensureWallet(storeId: string, customerId: string): Promise<LoyaltyWalletRecord> {
    return this.loyaltyRepository.withTransaction(async (db) =>
      this.loyaltyRepository.ensureWalletForUpdate(db, storeId, customerId),
    );
  }

  private normalizeRulesInput(rules: LoyaltyEarnRuleInputDto[]) {
    return rules.map((rule, index) => ({
      name: rule.name.trim(),
      ruleType: rule.ruleType,
      earnRate: rule.earnRate,
      minOrderAmount: rule.minOrderAmount,
      isActive: rule.isActive ?? true,
      priority: rule.priority ?? (index + 1) * 100,
    }));
  }

  private mapProgram(program: LoyaltyProgramRecord): LoyaltySettingsResponse {
    return {
      isEnabled: program.is_enabled,
      redeemRatePoints: program.redeem_rate_points,
      redeemRateAmount: Number(program.redeem_rate_amount),
      minRedeemPoints: program.min_redeem_points,
      redeemStepPoints: program.redeem_step_points,
      maxDiscountPercent: Number(program.max_discount_percent),
    };
  }

  private mapWallet(wallet: LoyaltyWalletRecord): LoyaltyWalletResponse {
    return {
      customerId: wallet.customer_id,
      availablePoints: wallet.available_points,
      lockedPoints: wallet.locked_points,
      lifetimeEarnedPoints: wallet.lifetime_earned_points,
      lifetimeRedeemedPoints: wallet.lifetime_redeemed_points,
    };
  }

  private mapLedger(row: LoyaltyLedgerRecord): LoyaltyLedgerEntryResponse {
    return {
      id: row.id,
      customerId: row.customer_id,
      orderId: row.order_id,
      entryType: row.entry_type,
      pointsDelta: row.points_delta,
      amountDelta: Number(row.amount_delta),
      balanceAfter: row.balance_after,
      referenceEntryId: row.reference_entry_id,
      reason: row.reason,
      metadata: row.metadata,
      createdByStoreUserId: row.created_by_store_user_id,
      createdAt: row.created_at,
    };
  }
}
