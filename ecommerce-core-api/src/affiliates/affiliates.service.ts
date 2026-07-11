import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import type {
  AffiliateAttributionType,
  AffiliateCommissionStatus,
} from './constants/affiliate.constants';
import type { CreateAffiliateDto } from './dto/create-affiliate.dto';
import type { CreateAffiliateLinkDto } from './dto/create-affiliate-link.dto';
import type { CreateAffiliatePayoutBatchDto } from './dto/create-affiliate-payout-batch.dto';
import type { ListAffiliateCommissionsQueryDto } from './dto/list-affiliate-commissions-query.dto';
import type { MarkAffiliatePayoutPaidDto } from './dto/mark-affiliate-payout-paid.dto';
import type { UpdateAffiliateDto } from './dto/update-affiliate.dto';
import type { UpdateAffiliateSettingsDto } from './dto/update-affiliate-settings.dto';
import { AffiliatesRepository, type Queryable } from './affiliates.repository';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';

export interface AffiliateResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  commissionRatePercent: number;
  payoutMethod: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateLinkResponse {
  id: string;
  affiliateId: string;
  code: string;
  targetPath: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AffiliateCommissionResponse {
  id: string;
  orderId: string;
  orderCode: string;
  affiliateId: string;
  affiliateName: string;
  status: AffiliateCommissionStatus;
  commissionBase: number;
  commissionAmount: number;
  reversedAmount: number;
  netAmount: number;
  approvedAt: Date | null;
  paidAt: Date | null;
  reversedAt: Date | null;
  createdAt: Date;
}

export interface AffiliatePayoutBatchResponse {
  id: string;
  status: string;
  currencyCode: string;
  totalAmount: number;
  itemsCount: number;
  note: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface AffiliateSettingsResponse {
  enabled: boolean;
  defaultRatePercent: number;
  attributionWindowDays: number;
  minPayoutAmount: number;
}

export interface CheckoutAttributionResolution {
  affiliateId: string;
  affiliateLinkId: string | null;
  couponId: string | null;
  couponCode: string | null;
  attributionType: AffiliateAttributionType;
  sessionId: string | null;
}

@Injectable()
export class AffiliatesService {
  constructor(
    private readonly affiliatesRepository: AffiliatesRepository,
    private readonly auditService: AuditService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
  ) {}

  async getSettings(currentUser: AuthUser): Promise<AffiliateSettingsResponse> {
    const row = await this.affiliatesRepository.getStoreSettings(currentUser.storeId);
    return this.mapSettings(row);
  }

  async updateSettings(
    currentUser: AuthUser,
    input: UpdateAffiliateSettingsDto,
    context: RequestContextData,
  ): Promise<AffiliateSettingsResponse> {
    const current = await this.affiliatesRepository.getStoreSettings(currentUser.storeId);
    const updated = await this.affiliatesRepository.updateStoreSettings({
      storeId: currentUser.storeId,
      enabled: input.enabled ?? current.affiliate_enabled,
      defaultRatePercent: input.defaultRatePercent ?? Number(current.affiliate_default_rate),
      attributionWindowDays:
        input.attributionWindowDays ?? current.affiliate_attribution_window_days,
      minPayoutAmount: input.minPayoutAmount ?? Number(current.affiliate_min_payout),
    });

    await this.auditService.log({
      action: 'affiliates.settings_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate_settings',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
    return this.mapSettings(updated);
  }

  async createAffiliate(
    currentUser: AuthUser,
    input: CreateAffiliateDto,
    context: RequestContextData,
  ): Promise<AffiliateResponse> {
    const settings = await this.affiliatesRepository.getStoreSettings(currentUser.storeId);
    const row = await this.affiliatesRepository.createAffiliate({
      storeId: currentUser.storeId,
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() ?? null,
      phone: input.phone?.trim() ?? null,
      commissionRatePercent: input.commissionRatePercent ?? Number(settings.affiliate_default_rate),
      payoutMethod: input.payoutMethod?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
    });

    await this.auditService.log({
      action: 'affiliates.affiliate_created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate',
      targetId: row.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
    return this.mapAffiliate(row);
  }

  async listAffiliates(currentUser: AuthUser, q?: string): Promise<AffiliateResponse[]> {
    const rows = await this.affiliatesRepository.listAffiliates(currentUser.storeId, q?.trim());
    return rows.map((row) => this.mapAffiliate(row));
  }

  async updateAffiliate(
    currentUser: AuthUser,
    affiliateId: string,
    input: UpdateAffiliateDto,
    context: RequestContextData,
  ): Promise<AffiliateResponse> {
    const current = await this.affiliatesRepository.findAffiliateById(
      currentUser.storeId,
      affiliateId,
    );
    if (!current) {
      throw new NotFoundException('Affiliate not found');
    }

    const updated = await this.affiliatesRepository.updateAffiliate({
      storeId: currentUser.storeId,
      affiliateId,
      name: input.name?.trim() ?? current.name,
      email:
        input.email === undefined ? current.email : (input.email?.trim().toLowerCase() ?? null),
      phone: input.phone === undefined ? current.phone : (input.phone?.trim() ?? null),
      status: input.status ?? current.status,
      commissionRatePercent: input.commissionRatePercent ?? Number(current.commission_rate_percent),
      payoutMethod:
        input.payoutMethod === undefined
          ? current.payout_method
          : (input.payoutMethod?.trim() ?? null),
      notes: input.notes === undefined ? current.notes : (input.notes?.trim() ?? null),
    });

    if (!updated) {
      throw new NotFoundException('Affiliate not found');
    }

    await this.auditService.log({
      action: 'affiliates.affiliate_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate',
      targetId: affiliateId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
    return this.mapAffiliate(updated);
  }

  async createLink(
    currentUser: AuthUser,
    affiliateId: string,
    input: CreateAffiliateLinkDto,
    context: RequestContextData,
  ): Promise<AffiliateLinkResponse> {
    const affiliate = await this.affiliatesRepository.findAffiliateById(
      currentUser.storeId,
      affiliateId,
    );
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }

    const link = await this.affiliatesRepository.createAffiliateLink({
      storeId: currentUser.storeId,
      affiliateId,
      code: input.code.trim(),
      targetPath: input.targetPath?.trim() || '/',
    });

    await this.auditService.log({
      action: 'affiliates.link_created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate_link',
      targetId: link.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });

    return this.mapLink(link);
  }

  async listLinks(currentUser: AuthUser, affiliateId: string): Promise<AffiliateLinkResponse[]> {
    const affiliate = await this.affiliatesRepository.findAffiliateById(
      currentUser.storeId,
      affiliateId,
    );
    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }
    const rows = await this.affiliatesRepository.listLinksForAffiliate(
      currentUser.storeId,
      affiliateId,
    );
    return rows.map((row) => this.mapLink(row));
  }

  async listCommissions(
    currentUser: AuthUser,
    query: ListAffiliateCommissionsQueryDto,
  ): Promise<{ items: AffiliateCommissionResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters: {
      storeId: string;
      affiliateId?: string;
      status?: AffiliateCommissionStatus;
      q?: string;
      limit: number;
      offset: number;
    } = {
      storeId: currentUser.storeId,
      limit,
      offset: (page - 1) * limit,
    };
    if (query.affiliateId) {
      filters.affiliateId = query.affiliateId;
    }
    if (query.status) {
      filters.status = query.status;
    }
    const keyword = query.q?.trim();
    if (keyword) {
      filters.q = keyword;
    }
    const result = await this.affiliatesRepository.listCommissions(filters);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderCode: row.order_code,
        affiliateId: row.affiliate_id,
        affiliateName: row.affiliate_name,
        status: row.status,
        commissionBase: Number(row.commission_base),
        commissionAmount: Number(row.commission_amount),
        reversedAmount: Number(row.reversed_amount),
        netAmount: Number(row.net_amount),
        approvedAt: row.approved_at,
        paidAt: row.paid_at,
        reversedAt: row.reversed_at,
        createdAt: row.created_at,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  async createPayoutBatch(
    currentUser: AuthUser,
    input: CreateAffiliatePayoutBatchDto,
    context: RequestContextData,
  ): Promise<AffiliatePayoutBatchResponse> {
    const batch = await this.affiliatesRepository.withTransaction((db) =>
      this.affiliatesRepository.createPayoutBatch(db, {
        storeId: currentUser.storeId,
        createdBy: currentUser.id,
        note: input.note?.trim() ?? null,
      }),
    );

    await this.auditService.log({
      action: 'affiliates.payout_batch_created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate_payout_batch',
      targetId: batch.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });

    return this.mapPayoutBatch(batch);
  }

  async listPayoutBatches(currentUser: AuthUser): Promise<AffiliatePayoutBatchResponse[]> {
    const rows = await this.affiliatesRepository.listPayoutBatches(currentUser.storeId);
    return rows.map((row) => this.mapPayoutBatch(row));
  }

  async markPayoutBatchPaid(
    currentUser: AuthUser,
    batchId: string,
    input: MarkAffiliatePayoutPaidDto,
    context: RequestContextData,
  ): Promise<{ markedPaid: true }> {
    const success = await this.affiliatesRepository.withTransaction((db) =>
      this.affiliatesRepository.markPayoutBatchPaid(db, {
        storeId: currentUser.storeId,
        batchId,
        note: input.note?.trim() ?? null,
      }),
    );
    if (!success) {
      throw new NotFoundException('Payout batch not found');
    }

    await this.auditService.log({
      action: 'affiliates.payout_batch_marked_paid',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'affiliate_payout_batch',
      targetId: batchId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });

    return { markedPaid: true };
  }

  async exportCommissionsCsv(currentUser: AuthUser): Promise<string> {
    const rows = await this.affiliatesRepository.listAllCommissionsForExport(currentUser.storeId);
    const header = [
      'commission_id',
      'order_id',
      'order_code',
      'affiliate_id',
      'affiliate_name',
      'status',
      'commission_base',
      'commission_amount',
      'reversed_amount',
      'net_amount',
      'approved_at',
      'paid_at',
      'reversed_at',
      'created_at',
    ];
    const lines = [header.join(',')];

    for (const row of rows) {
      const columns = [
        row.id,
        row.order_id,
        row.order_code,
        row.affiliate_id,
        row.affiliate_name,
        row.status,
        row.commission_base,
        row.commission_amount,
        row.reversed_amount,
        row.net_amount,
        row.approved_at?.toISOString() ?? '',
        row.paid_at?.toISOString() ?? '',
        row.reversed_at?.toISOString() ?? '',
        row.created_at.toISOString(),
      ];
      lines.push(columns.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    return `${lines.join('\n')}\n`;
  }

  async trackAffiliateClickFromRequest(
    request: Request,
    input: { storeId: string; sessionId: string },
  ): Promise<void> {
    if (
      !(await this.storeCapabilitiesService.isFeatureEnabled(input.storeId, 'affiliate_program'))
    ) {
      return;
    }

    const affCode = this.readStringQuery(request, 'aff');
    if (!affCode) {
      return;
    }

    const linkResult = await this.affiliatesRepository.findActiveLinkByCode(input.storeId, affCode);
    if (!linkResult) {
      return;
    }

    await this.affiliatesRepository.insertAffiliateClick({
      storeId: input.storeId,
      affiliateId: linkResult.link.affiliate_id,
      affiliateLinkId: linkResult.link.id,
      sessionId: input.sessionId,
      utmSource: this.readStringQuery(request, 'utm_source'),
      utmMedium: this.readStringQuery(request, 'utm_medium'),
      utmCampaign: this.readStringQuery(request, 'utm_campaign'),
      utmTerm: this.readStringQuery(request, 'utm_term'),
      utmContent: this.readStringQuery(request, 'utm_content'),
      referrer:
        this.readStringHeader(request, 'referer') ?? this.readStringHeader(request, 'referrer'),
      landingPath: request.originalUrl?.slice(0, 300) ?? null,
    });
  }

  async resolveCheckoutAttribution(input: {
    storeId: string;
    sessionId: string | null;
    couponCode?: string | null;
  }): Promise<CheckoutAttributionResolution | null> {
    if (
      !(await this.storeCapabilitiesService.isFeatureEnabled(input.storeId, 'affiliate_program'))
    ) {
      return null;
    }

    const settings = await this.affiliatesRepository.getStoreSettings(input.storeId);
    if (!settings.affiliate_enabled) {
      return null;
    }

    const normalizedCoupon = input.couponCode?.trim();
    if (normalizedCoupon) {
      const couponAttribution = await this.affiliatesRepository.resolveCouponAttribution(
        input.storeId,
        normalizedCoupon,
      );
      if (couponAttribution) {
        return {
          affiliateId: couponAttribution.affiliate_id,
          affiliateLinkId: couponAttribution.affiliate_link_id,
          couponId: null,
          couponCode: normalizedCoupon,
          attributionType: 'coupon',
          sessionId: input.sessionId,
        };
      }
    }

    if (!input.sessionId) {
      return null;
    }

    const clickAttribution = await this.affiliatesRepository.resolveLastClickAttribution({
      storeId: input.storeId,
      sessionId: input.sessionId,
      windowDays: settings.affiliate_attribution_window_days,
    });

    if (!clickAttribution) {
      return null;
    }

    return {
      affiliateId: clickAttribution.affiliate_id,
      affiliateLinkId: clickAttribution.affiliate_link_id,
      couponId: null,
      couponCode: normalizedCoupon ?? null,
      attributionType: 'link',
      sessionId: input.sessionId,
    };
  }

  computeCommissionAmount(input: {
    subtotal: number;
    discountTotal: number;
    ratePercent: number;
  }): { commissionBase: number; commissionAmount: number } {
    const commissionBase = Math.max(0, Number((input.subtotal - input.discountTotal).toFixed(2)));
    const commissionAmount = Number(((commissionBase * input.ratePercent) / 100).toFixed(2));
    return {
      commissionBase,
      commissionAmount,
    };
  }

  async createPendingCommissionInTransaction(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      attribution: CheckoutAttributionResolution | null;
      subtotal: number;
      discountTotal: number;
    },
  ): Promise<void> {
    if (!input.attribution) {
      return;
    }

    const affiliate = await this.affiliatesRepository.findAffiliateById(
      input.storeId,
      input.attribution.affiliateId,
    );
    if (!affiliate || affiliate.status !== 'active') {
      return;
    }

    const rate = Number(affiliate.commission_rate_percent);
    const amounts = this.computeCommissionAmount({
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      ratePercent: rate,
    });

    await this.affiliatesRepository.createOrderAttributionAndCommission(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      affiliateId: input.attribution.affiliateId,
      affiliateLinkId: input.attribution.affiliateLinkId,
      couponId: input.attribution.couponId,
      couponCode: input.attribution.couponCode,
      attributionType: input.attribution.attributionType,
      sessionId: input.attribution.sessionId,
      commissionRatePercent: rate,
      commissionBase: amounts.commissionBase,
      commissionAmount: amounts.commissionAmount,
    });

    await this.affiliatesRepository.approveCommissionIfEligible(db, input.storeId, input.orderId);
  }

  async handleOrderStatusChangedInTransaction(
    db: Queryable,
    input: { storeId: string; orderId: string; nextStatus: string },
  ): Promise<void> {
    if (input.nextStatus === 'completed') {
      await this.affiliatesRepository.approveCommissionIfEligible(db, input.storeId, input.orderId);
      return;
    }

    if (input.nextStatus === 'cancelled' || input.nextStatus === 'returned') {
      await this.affiliatesRepository.reverseCommission(db, {
        storeId: input.storeId,
        orderId: input.orderId,
        reason: `order_${input.nextStatus}`,
      });
    }
  }

  async handlePaymentStatusChanged(input: {
    storeId: string;
    orderId: string;
    nextStatus: string;
  }): Promise<void> {
    await this.affiliatesRepository.withTransaction(async (db) => {
      if (input.nextStatus === 'approved') {
        await this.affiliatesRepository.approveCommissionIfEligible(
          db,
          input.storeId,
          input.orderId,
        );
      }
      if (input.nextStatus === 'refunded') {
        await this.affiliatesRepository.reverseCommission(db, {
          storeId: input.storeId,
          orderId: input.orderId,
          reason: 'payment_refunded',
        });
      }
    });
  }

  private mapAffiliate(row: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
    commission_rate_percent: string;
    payout_method: string | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
  }): AffiliateResponse {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      commissionRatePercent: Number(row.commission_rate_percent),
      payoutMethod: row.payout_method,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapLink(row: {
    id: string;
    affiliate_id: string;
    code: string;
    target_path: string;
    is_active: boolean;
    created_at: Date;
  }): AffiliateLinkResponse {
    return {
      id: row.id,
      affiliateId: row.affiliate_id,
      code: row.code,
      targetPath: row.target_path,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  private mapPayoutBatch(row: {
    id: string;
    status: string;
    currency_code: string;
    total_amount: string;
    items_count: number;
    note: string | null;
    paid_at: Date | null;
    created_at: Date;
  }): AffiliatePayoutBatchResponse {
    return {
      id: row.id,
      status: row.status,
      currencyCode: row.currency_code,
      totalAmount: Number(row.total_amount),
      itemsCount: row.items_count,
      note: row.note,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    };
  }

  private mapSettings(row: {
    affiliate_enabled: boolean;
    affiliate_default_rate: string;
    affiliate_attribution_window_days: number;
    affiliate_min_payout: string;
  }): AffiliateSettingsResponse {
    return {
      enabled: row.affiliate_enabled,
      defaultRatePercent: Number(row.affiliate_default_rate),
      attributionWindowDays: row.affiliate_attribution_window_days,
      minPayoutAmount: Number(row.affiliate_min_payout),
    };
  }

  private readStringQuery(request: Request, key: string): string | null {
    const value = request.query[key];
    const candidate = Array.isArray(value) ? value[0] : value;
    return typeof candidate === 'string' && candidate.trim().length > 0
      ? candidate.trim().slice(0, 200)
      : null;
  }

  private readStringHeader(request: Request, key: string): string | null {
    const value = request.headers[key];
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'string' && first.trim().length > 0
        ? first.trim().slice(0, 500)
        : null;
    }
    return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 500) : null;
  }
}
