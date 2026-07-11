import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { CustomerUser } from './interfaces/customer-user.interface';
import { EmailService } from '../email/email.service';
import {
  CustomerEngagementRepository,
  type ModerationStatus,
  type ProductQuestionRecord,
  type ReviewModerationRecord,
} from './customer-engagement.repository';

export interface ProductQuestionResponse {
  id: string;
  productId: string;
  productTitle: string;
  customerId: string | null;
  customerName: string | null;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  answeredByName: string | null;
  answeredAt: Date | null;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewModerationResponse {
  id: string;
  productId: string;
  productTitle: string;
  customerId: string | null;
  customerName: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  moderationStatus: ModerationStatus;
  moderatedBy: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestockProductStatsResponse {
  productId: string;
  productTitle: string;
  productSlug: string;
  subscribersCount: number;
  sentCount: number;
  ordersCount: number;
  salesAmount: number;
}

@Injectable()
export class CustomerEngagementService {
  constructor(
    private readonly engagementRepository: CustomerEngagementRepository,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async createProductQuestion(
    customer: CustomerUser,
    productId: string,
    question: string,
    context: RequestContextData,
  ): Promise<ProductQuestionResponse> {
    const product = await this.engagementRepository.findProductForEngagement(
      customer.storeId,
      productId,
    );
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.questions_enabled) {
      throw new BadRequestException('Questions are not enabled for this product');
    }

    const created = await this.engagementRepository.createProductQuestion({
      storeId: customer.storeId,
      productId,
      customerId: customer.id,
      customerName: customer.fullName,
      question,
    });

    await this.auditService.log({
      action: 'customer.question_created',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product_question',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        productId,
      },
    });

    return this.toQuestionResponse(created);
  }

  async listPublicProductQuestions(
    storeId: string,
    productId: string,
    limit = 20,
    offset = 0,
  ): Promise<{ items: ProductQuestionResponse[]; total: number }> {
    const rows = await this.engagementRepository.listPublicProductQuestions({
      storeId,
      productId,
      limit,
      offset,
    });

    return {
      items: rows.map((row) => this.toQuestionResponse(row)),
      total: rows.length,
    };
  }

  async subscribeToRestock(
    customer: CustomerUser,
    productId: string,
    context: RequestContextData,
  ): Promise<{ subscriptionId: string; message: string }> {
    const product = await this.engagementRepository.findProductForEngagement(
      customer.storeId,
      productId,
    );
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!customer.email) {
      throw new BadRequestException('Email is required to subscribe for stock alerts');
    }

    const outOfStock = await this.engagementRepository.isProductOutOfStock(
      customer.storeId,
      productId,
    );
    if (!outOfStock) {
      throw new BadRequestException('Product is currently in stock');
    }

    const subscription = await this.engagementRepository.createOrReactivateRestockSubscription({
      storeId: customer.storeId,
      productId,
      customerId: customer.id,
      email: customer.email,
    });

    await this.auditService.log({
      action: 'customer.restock_subscription_created',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product_restock_subscription',
      targetId: subscription.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        productId,
      },
    });

    return {
      subscriptionId: subscription.id,
      message: 'We will notify you by email when this product is back in stock.',
    };
  }

  async listManagedReviews(input: {
    currentUser: AuthUser;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
    page: number;
    limit: number;
  }): Promise<{ items: ReviewModerationResponse[]; total: number; page: number; limit: number }> {
    const offset = (input.page - 1) * input.limit;

    const [rows, total] = await Promise.all([
      this.engagementRepository.listManagedReviews({
        storeId: input.currentUser.storeId,
        q: input.q,
        status: input.status,
        productId: input.productId,
        limit: input.limit,
        offset,
      }),
      this.engagementRepository.countManagedReviews({
        storeId: input.currentUser.storeId,
        q: input.q,
        status: input.status,
        productId: input.productId,
      }),
    ]);

    return {
      items: rows.map((row) => this.toReviewModerationResponse(row)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async updateReviewModeration(input: {
    currentUser: AuthUser;
    reviewId: string;
    status: ModerationStatus;
    context: RequestContextData;
  }): Promise<ReviewModerationResponse> {
    const updated = await this.engagementRepository.updateReviewModeration({
      storeId: input.currentUser.storeId,
      reviewId: input.reviewId,
      status: input.status,
      moderatedBy: input.currentUser.id,
    });

    if (!updated) {
      throw new NotFoundException('Review not found');
    }

    await this.auditService.log({
      action: 'customers.manage.review_moderated',
      storeId: input.currentUser.storeId,
      storeUserId: input.currentUser.id,
      targetType: 'product_review',
      targetId: input.reviewId,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      metadata: {
        requestId: input.context.requestId,
        status: input.status,
      },
    });

    return this.toReviewModerationResponse(updated);
  }

  async listManagedQuestions(input: {
    currentUser: AuthUser;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
    page: number;
    limit: number;
  }): Promise<{ items: ProductQuestionResponse[]; total: number; page: number; limit: number }> {
    const offset = (input.page - 1) * input.limit;

    const [rows, total] = await Promise.all([
      this.engagementRepository.listManagedQuestions({
        storeId: input.currentUser.storeId,
        q: input.q,
        status: input.status,
        productId: input.productId,
        limit: input.limit,
        offset,
      }),
      this.engagementRepository.countManagedQuestions({
        storeId: input.currentUser.storeId,
        q: input.q,
        status: input.status,
        productId: input.productId,
      }),
    ]);

    return {
      items: rows.map((row) => this.toQuestionResponse(row)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async updateQuestionModeration(input: {
    currentUser: AuthUser;
    questionId: string;
    answer: string | null;
    status: ModerationStatus;
    context: RequestContextData;
  }): Promise<ProductQuestionResponse> {
    if (input.status === 'APPROVED' && !input.answer) {
      throw new BadRequestException('Answer is required before approving and publishing');
    }

    const updated = await this.engagementRepository.updateQuestionModeration({
      storeId: input.currentUser.storeId,
      questionId: input.questionId,
      answer: input.answer,
      status: input.status,
      answeredBy: input.currentUser.id,
    });

    if (!updated) {
      throw new NotFoundException('Question not found');
    }

    await this.auditService.log({
      action: 'customers.manage.question_moderated',
      storeId: input.currentUser.storeId,
      storeUserId: input.currentUser.id,
      targetType: 'product_question',
      targetId: input.questionId,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      metadata: {
        requestId: input.context.requestId,
        status: input.status,
      },
    });

    return this.toQuestionResponse(updated);
  }

  async getRestockOverview(currentUser: AuthUser): Promise<{
    subscribersCount: number;
    sentCount: number;
    ordersCount: number;
    salesAmount: number;
  }> {
    const data = await this.engagementRepository.getRestockOverview(currentUser.storeId);
    return {
      subscribersCount: data.subscribers_count,
      sentCount: data.sent_count,
      ordersCount: data.orders_count,
      salesAmount: data.sales_amount,
    };
  }

  async listRestockProductStats(input: {
    currentUser: AuthUser;
    q: string | null;
    page: number;
    limit: number;
  }): Promise<{
    items: RestockProductStatsResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (input.page - 1) * input.limit;

    const [rows, total] = await Promise.all([
      this.engagementRepository.listRestockProductStats({
        storeId: input.currentUser.storeId,
        q: input.q,
        limit: input.limit,
        offset,
      }),
      this.engagementRepository.countRestockProductStats({
        storeId: input.currentUser.storeId,
        q: input.q,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        productId: row.product_id,
        productTitle: row.product_title,
        productSlug: row.product_slug,
        subscribersCount: row.subscribers_count,
        sentCount: row.sent_count,
        ordersCount: row.orders_count,
        salesAmount: row.sales_amount,
      })),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async dispatchBackInStockNotifications(input: {
    storeId: string;
    productId: string;
    variantId?: string;
  }): Promise<{ sentCount: number; failedCount: number }> {
    const product = await this.engagementRepository.findProductForEngagement(
      input.storeId,
      input.productId,
    );
    if (!product) {
      return { sentCount: 0, failedCount: 0 };
    }

    const subscriptions = await this.engagementRepository.listDispatchableRestockSubscriptions({
      storeId: input.storeId,
      productId: input.productId,
      cooldownHours: this.getRestockCooldownHours(),
    });

    if (subscriptions.length === 0) {
      return { sentCount: 0, failedCount: 0 };
    }

    const expiresAt = new Date(
      Date.now() + this.getRestockConversionWindowDays() * 24 * 60 * 60 * 1000,
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const subscription of subscriptions) {
      try {
        const token = `${subscription.subscription_id}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;

        await this.engagementRepository.createRestockNotification({
          storeId: subscription.store_id,
          productId: subscription.product_id,
          variantId: input.variantId ?? null,
          subscriptionId: subscription.subscription_id,
          customerId: subscription.customer_id,
          email: subscription.email,
          token,
          expiresAt,
        });

        await this.emailService.sendBackInStockAlert({
          to: subscription.email,
          productTitle: subscription.product_title,
          productUrl: this.buildRestockTrackingUrl(token),
        });

        await this.engagementRepository.markSubscriptionNotified(subscription.subscription_id);
        sentCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return { sentCount, failedCount };
  }

  async trackRestockClickAndBuildRedirect(token: string): Promise<string> {
    const tracked = await this.engagementRepository.trackRestockNotificationClick(token);
    if (!tracked) {
      throw new NotFoundException('Tracking token not found');
    }

    const storefrontBase = this.getStorefrontBaseUrl();
    return `${storefrontBase}/products/${encodeURIComponent(tracked.product_slug)}?store=${encodeURIComponent(tracked.store_slug)}&rst=${encodeURIComponent(token)}`;
  }

  async attachRestockConversion(input: {
    token: string;
    storeId: string;
    customerId: string;
    orderId: string;
    amount: number;
  }): Promise<boolean> {
    return this.engagementRepository.attachRestockOrderConversion(input);
  }

  private getStorefrontBaseUrl(): string {
    const value = this.configService.get<string>('STOREFRONT_BASE_URL', 'http://localhost:3001');
    return value.endsWith('/') ? value.slice(0, -1) : value;
  }

  private buildRestockTrackingUrl(token: string): string {
    const apiBase = this.configService.get<string>('API_PUBLIC_BASE_URL', 'http://localhost:3000');
    const normalized = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${normalized}/app/restock/track/${encodeURIComponent(token)}`;
  }

  private getRestockConversionWindowDays(): number {
    const raw = this.configService.get<number>('RESTOCK_CONVERSION_WINDOW_DAYS', 7);
    if (!Number.isInteger(raw) || raw < 1 || raw > 30) {
      return 7;
    }
    return raw;
  }

  private getRestockCooldownHours(): number {
    const raw = this.configService.get<number>('RESTOCK_NOTIFICATION_COOLDOWN_HOURS', 6);
    if (!Number.isInteger(raw) || raw < 1 || raw > 168) {
      return 6;
    }
    return raw;
  }

  private toQuestionResponse(row: ProductQuestionRecord): ProductQuestionResponse {
    return {
      id: row.id,
      productId: row.product_id,
      productTitle: row.product_title,
      customerId: row.customer_id,
      customerName: row.customer_name,
      question: row.question,
      answer: row.answer,
      answeredBy: row.answered_by,
      answeredByName: row.answered_by_name,
      answeredAt: row.answered_at,
      moderationStatus: row.moderation_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toReviewModerationResponse(row: ReviewModerationRecord): ReviewModerationResponse {
    return {
      id: row.id,
      productId: row.product_id,
      productTitle: row.product_title,
      customerId: row.customer_id,
      customerName: row.customer_name,
      orderId: row.order_id,
      rating: row.rating,
      comment: row.comment,
      isVerifiedPurchase: row.is_verified_purchase,
      moderationStatus: row.moderation_status,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
