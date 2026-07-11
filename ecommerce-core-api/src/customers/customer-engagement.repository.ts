import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export interface ProductQuestionRecord {
  id: string;
  store_id: string;
  product_id: string;
  product_title: string;
  customer_id: string | null;
  customer_name: string | null;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_by_name: string | null;
  answered_at: Date | null;
  moderation_status: ModerationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ReviewModerationRecord {
  id: string;
  store_id: string;
  product_id: string;
  product_title: string;
  customer_id: string | null;
  customer_name: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  is_verified_purchase: boolean;
  moderation_status: ModerationStatus;
  moderated_by: string | null;
  moderated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RestockProductStatsRecord {
  product_id: string;
  product_title: string;
  product_slug: string;
  subscribers_count: number;
  sent_count: number;
  orders_count: number;
  sales_amount: number;
}

export interface RestockOverviewRecord {
  subscribers_count: number;
  sent_count: number;
  orders_count: number;
  sales_amount: number;
}

export interface RestockDispatchSubscriptionRecord {
  subscription_id: string;
  store_id: string;
  store_slug: string;
  product_id: string;
  product_slug: string;
  product_title: string;
  customer_id: string;
  email: string;
}

export interface RestockTrackedNotificationRecord {
  id: string;
  token: string;
  store_id: string;
  store_slug: string;
  product_id: string;
  product_slug: string;
}

export interface ProductQuestionEnabledRecord {
  id: string;
  title: string;
  slug: string;
  questions_enabled: boolean;
  stock_unlimited: boolean;
  product_type: 'single' | 'bundled' | 'digital';
}

@Injectable()
export class CustomerEngagementRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findProductForEngagement(
    storeId: string,
    productId: string,
  ): Promise<ProductQuestionEnabledRecord | null> {
    const result = await this.databaseService.db.query<ProductQuestionEnabledRecord>(
      `
        SELECT id, title, slug, questions_enabled, stock_unlimited, product_type
        FROM products
        WHERE store_id = $1 AND id = $2
        LIMIT 1
      `,
      [storeId, productId],
    );
    return result.rows[0] ?? null;
  }

  async isProductOutOfStock(storeId: string, productId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{
      stock_unlimited: boolean;
      total_stock: string;
    }>(
      `
        SELECT
          p.stock_unlimited,
          COALESCE(SUM(pv.stock_quantity), 0)::text AS total_stock
        FROM products p
        LEFT JOIN product_variants pv
          ON pv.product_id = p.id
         AND pv.store_id = p.store_id
        WHERE p.store_id = $1
          AND p.id = $2
        GROUP BY p.stock_unlimited
      `,
      [storeId, productId],
    );

    const row = result.rows[0];
    if (!row) {
      return false;
    }

    if (row.stock_unlimited) {
      return false;
    }

    return Number(row.total_stock) <= 0;
  }

  async createProductQuestion(input: {
    storeId: string;
    productId: string;
    customerId: string;
    customerName: string;
    question: string;
  }): Promise<ProductQuestionRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<ProductQuestionRecord>(
      `
        INSERT INTO product_faq (
          id,
          store_id,
          product_id,
          customer_id,
          customer_name,
          question,
          answer,
          is_approved,
          is_public,
          moderation_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, NULL, FALSE, FALSE, 'PENDING')
        RETURNING
          id,
          store_id,
          product_id,
          (SELECT title FROM products WHERE id = product_id) AS product_title,
          customer_id,
          customer_name,
          question,
          answer,
          answered_by,
          (SELECT full_name FROM store_users WHERE id = answered_by) AS answered_by_name,
          answered_at,
          moderation_status,
          created_at,
          updated_at
      `,
      [id, input.storeId, input.productId, input.customerId, input.customerName, input.question],
    );

    return result.rows[0] as ProductQuestionRecord;
  }

  async listPublicProductQuestions(input: {
    storeId: string;
    productId: string;
    limit: number;
    offset: number;
  }): Promise<ProductQuestionRecord[]> {
    const result = await this.databaseService.db.query<ProductQuestionRecord>(
      `
        SELECT
          id,
          store_id,
          product_id,
          (SELECT title FROM products WHERE id = product_id) AS product_title,
          customer_id,
          customer_name,
          question,
          answer,
          answered_by,
          (SELECT full_name FROM store_users WHERE id = answered_by) AS answered_by_name,
          answered_at,
          moderation_status,
          created_at,
          updated_at
        FROM product_faq
        WHERE store_id = $1
          AND product_id = $2
          AND moderation_status = 'APPROVED'
          AND answer IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [input.storeId, input.productId, input.limit, input.offset],
    );

    return result.rows;
  }

  async listManagedQuestions(input: {
    storeId: string;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
    limit: number;
    offset: number;
  }): Promise<ProductQuestionRecord[]> {
    const result = await this.databaseService.db.query<ProductQuestionRecord>(
      `
        SELECT
          q.id,
          q.store_id,
          q.product_id,
          p.title AS product_title,
          q.customer_id,
          COALESCE(c.full_name, q.customer_name) AS customer_name,
          q.question,
          q.answer,
          q.answered_by,
          su.full_name AS answered_by_name,
          q.answered_at,
          q.moderation_status,
          q.created_at,
          q.updated_at
        FROM product_faq q
        INNER JOIN products p
          ON p.id = q.product_id
         AND p.store_id = q.store_id
        LEFT JOIN customers c
          ON c.id = q.customer_id
        LEFT JOIN store_users su
          ON su.id = q.answered_by
        WHERE q.store_id = $1
          AND ($2::text IS NULL OR q.moderation_status = $2)
          AND ($3::uuid IS NULL OR q.product_id = $3)
          AND (
            $4::text IS NULL
            OR p.title ILIKE '%' || $4 || '%'
            OR COALESCE(c.full_name, q.customer_name, '') ILIKE '%' || $4 || '%'
            OR q.question ILIKE '%' || $4 || '%'
          )
        ORDER BY q.created_at DESC
        LIMIT $5 OFFSET $6
      `,
      [input.storeId, input.status, input.productId, input.q, input.limit, input.offset],
    );

    return result.rows;
  }

  async countManagedQuestions(input: {
    storeId: string;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
  }): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM product_faq q
        INNER JOIN products p
          ON p.id = q.product_id
         AND p.store_id = q.store_id
        LEFT JOIN customers c
          ON c.id = q.customer_id
        WHERE q.store_id = $1
          AND ($2::text IS NULL OR q.moderation_status = $2)
          AND ($3::uuid IS NULL OR q.product_id = $3)
          AND (
            $4::text IS NULL
            OR p.title ILIKE '%' || $4 || '%'
            OR COALESCE(c.full_name, q.customer_name, '') ILIKE '%' || $4 || '%'
            OR q.question ILIKE '%' || $4 || '%'
          )
      `,
      [input.storeId, input.status, input.productId, input.q],
    );

    return Number(result.rows[0]?.total ?? '0');
  }

  async updateQuestionModeration(input: {
    storeId: string;
    questionId: string;
    answer: string | null;
    status: ModerationStatus;
    answeredBy: string;
  }): Promise<ProductQuestionRecord | null> {
    const result = await this.databaseService.db.query<ProductQuestionRecord>(
      `
        UPDATE product_faq
        SET
          answer = $3,
          answered_by = $4,
          answered_at = CASE WHEN $3::text IS NULL THEN answered_at ELSE NOW() END,
          is_approved = ($5 = 'APPROVED'),
          is_public = ($5 = 'APPROVED'),
          moderation_status = $5,
          updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING
          id,
          store_id,
          product_id,
          (SELECT title FROM products WHERE id = product_id) AS product_title,
          customer_id,
          customer_name,
          question,
          answer,
          answered_by,
          (SELECT full_name FROM store_users WHERE id = answered_by) AS answered_by_name,
          answered_at,
          moderation_status,
          created_at,
          updated_at
      `,
      [input.storeId, input.questionId, input.answer, input.answeredBy, input.status],
    );

    return result.rows[0] ?? null;
  }

  async listManagedReviews(input: {
    storeId: string;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
    limit: number;
    offset: number;
  }): Promise<ReviewModerationRecord[]> {
    const result = await this.databaseService.db.query<ReviewModerationRecord>(
      `
        SELECT
          r.id,
          r.store_id,
          r.product_id,
          p.title AS product_title,
          r.customer_id,
          COALESCE(c.full_name, 'Unknown customer') AS customer_name,
          r.order_id,
          r.rating,
          r.comment,
          r.is_verified_purchase,
          r.moderation_status,
          r.moderated_by,
          r.moderated_at,
          r.created_at,
          r.updated_at
        FROM product_reviews r
        INNER JOIN products p
          ON p.id = r.product_id
         AND p.store_id = r.store_id
        LEFT JOIN customers c
          ON c.id = r.customer_id
        WHERE r.store_id = $1
          AND ($2::text IS NULL OR r.moderation_status = $2)
          AND ($3::uuid IS NULL OR r.product_id = $3)
          AND (
            $4::text IS NULL
            OR p.title ILIKE '%' || $4 || '%'
            OR COALESCE(c.full_name, '') ILIKE '%' || $4 || '%'
            OR COALESCE(r.comment, '') ILIKE '%' || $4 || '%'
          )
        ORDER BY r.created_at DESC
        LIMIT $5 OFFSET $6
      `,
      [input.storeId, input.status, input.productId, input.q, input.limit, input.offset],
    );

    return result.rows;
  }

  async countManagedReviews(input: {
    storeId: string;
    q: string | null;
    status: ModerationStatus | null;
    productId: string | null;
  }): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM product_reviews r
        INNER JOIN products p
          ON p.id = r.product_id
         AND p.store_id = r.store_id
        LEFT JOIN customers c
          ON c.id = r.customer_id
        WHERE r.store_id = $1
          AND ($2::text IS NULL OR r.moderation_status = $2)
          AND ($3::uuid IS NULL OR r.product_id = $3)
          AND (
            $4::text IS NULL
            OR p.title ILIKE '%' || $4 || '%'
            OR COALESCE(c.full_name, '') ILIKE '%' || $4 || '%'
            OR COALESCE(r.comment, '') ILIKE '%' || $4 || '%'
          )
      `,
      [input.storeId, input.status, input.productId, input.q],
    );

    return Number(result.rows[0]?.total ?? '0');
  }

  async updateReviewModeration(input: {
    storeId: string;
    reviewId: string;
    status: ModerationStatus;
    moderatedBy: string;
  }): Promise<ReviewModerationRecord | null> {
    const result = await this.databaseService.db.query<ReviewModerationRecord>(
      `
        UPDATE product_reviews
        SET
          moderation_status = $3,
          moderated_by = $4,
          moderated_at = NOW(),
          updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING
          id,
          store_id,
          product_id,
          (SELECT title FROM products WHERE id = product_id) AS product_title,
          customer_id,
          (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
          order_id,
          rating,
          comment,
          is_verified_purchase,
          moderation_status,
          moderated_by,
          moderated_at,
          created_at,
          updated_at
      `,
      [input.storeId, input.reviewId, input.status, input.moderatedBy],
    );

    return result.rows[0] ?? null;
  }

  async createOrReactivateRestockSubscription(input: {
    storeId: string;
    productId: string;
    customerId: string;
    email: string;
  }): Promise<{
    id: string;
    store_id: string;
    product_id: string;
    customer_id: string;
    email: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }> {
    const id = uuidv4();

    const result = await this.databaseService.db.query<{
      id: string;
      store_id: string;
      product_id: string;
      customer_id: string;
      email: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        INSERT INTO product_restock_subscriptions (
          id,
          store_id,
          product_id,
          customer_id,
          email,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (store_id, product_id, customer_id)
        DO UPDATE
          SET email = EXCLUDED.email,
              is_active = TRUE,
              updated_at = NOW()
        RETURNING id, store_id, product_id, customer_id, email, is_active, created_at, updated_at
      `,
      [id, input.storeId, input.productId, input.customerId, input.email],
    );

    return result.rows[0] as {
      id: string;
      store_id: string;
      product_id: string;
      customer_id: string;
      email: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    };
  }

  async listDispatchableRestockSubscriptions(input: {
    storeId: string;
    productId: string;
    cooldownHours: number;
  }): Promise<RestockDispatchSubscriptionRecord[]> {
    const result = await this.databaseService.db.query<RestockDispatchSubscriptionRecord>(
      `
        SELECT
          s.id AS subscription_id,
          s.store_id,
          st.slug AS store_slug,
          s.product_id,
          p.slug AS product_slug,
          p.title AS product_title,
          s.customer_id,
          s.email
        FROM product_restock_subscriptions s
        INNER JOIN stores st
          ON st.id = s.store_id
        INNER JOIN products p
          ON p.id = s.product_id
         AND p.store_id = s.store_id
        WHERE s.store_id = $1
          AND s.product_id = $2
          AND s.is_active = TRUE
          AND (
            s.last_notified_at IS NULL
            OR s.last_notified_at < NOW() - ($3::text || ' hours')::interval
          )
        ORDER BY s.created_at ASC
      `,
      [input.storeId, input.productId, String(input.cooldownHours)],
    );

    return result.rows;
  }

  async createRestockNotification(input: {
    storeId: string;
    productId: string;
    variantId: string | null;
    subscriptionId: string;
    customerId: string;
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<{ id: string; sent_at: Date }> {
    const id = uuidv4();

    const result = await this.databaseService.db.query<{ id: string; sent_at: Date }>(
      `
        INSERT INTO product_restock_notifications (
          id,
          store_id,
          product_id,
          variant_id,
          subscription_id,
          customer_id,
          email,
          token,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, sent_at
      `,
      [
        id,
        input.storeId,
        input.productId,
        input.variantId,
        input.subscriptionId,
        input.customerId,
        input.email,
        input.token,
        input.expiresAt,
      ],
    );

    return result.rows[0] as { id: string; sent_at: Date };
  }

  async markSubscriptionNotified(subscriptionId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE product_restock_subscriptions
        SET last_notified_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [subscriptionId],
    );
  }

  async trackRestockNotificationClick(
    token: string,
  ): Promise<RestockTrackedNotificationRecord | null> {
    const result = await this.databaseService.db.query<RestockTrackedNotificationRecord>(
      `
        UPDATE product_restock_notifications n
        SET clicked_at = COALESCE(n.clicked_at, NOW()),
            updated_at = NOW()
        FROM stores s,
             products p
        WHERE n.token = $1
          AND s.id = n.store_id
          AND p.id = n.product_id
        RETURNING
          n.id,
          n.token,
          n.store_id,
          s.slug AS store_slug,
          n.product_id,
          p.slug AS product_slug
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  async attachRestockOrderConversion(input: {
    token: string;
    storeId: string;
    customerId: string;
    orderId: string;
    amount: number;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE product_restock_notifications
        SET
          created_order_id = $4,
          conversion_amount = $5,
          converted_at = NOW(),
          updated_at = NOW()
        WHERE token = $1
          AND store_id = $2
          AND customer_id = $3
          AND created_order_id IS NULL
          AND expires_at > NOW()
      `,
      [input.token, input.storeId, input.customerId, input.orderId, input.amount],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getRestockOverview(storeId: string): Promise<RestockOverviewRecord> {
    const result = await this.databaseService.db.query<{
      subscribers_count: string;
      sent_count: string;
      orders_count: string;
      sales_amount: string;
    }>(
      `
        SELECT
          (SELECT COUNT(*)::text FROM product_restock_subscriptions WHERE store_id = $1 AND is_active = TRUE) AS subscribers_count,
          (SELECT COUNT(*)::text FROM product_restock_notifications WHERE store_id = $1) AS sent_count,
          (SELECT COUNT(*)::text FROM product_restock_notifications WHERE store_id = $1 AND created_order_id IS NOT NULL) AS orders_count,
          (SELECT COALESCE(SUM(conversion_amount), 0)::text FROM product_restock_notifications WHERE store_id = $1 AND created_order_id IS NOT NULL) AS sales_amount
      `,
      [storeId],
    );

    const row = result.rows[0];
    return {
      subscribers_count: Number(row?.subscribers_count ?? '0'),
      sent_count: Number(row?.sent_count ?? '0'),
      orders_count: Number(row?.orders_count ?? '0'),
      sales_amount: Number(row?.sales_amount ?? '0'),
    };
  }

  async listRestockProductStats(input: {
    storeId: string;
    q: string | null;
    limit: number;
    offset: number;
  }): Promise<RestockProductStatsRecord[]> {
    const result = await this.databaseService.db.query<RestockProductStatsRecord>(
      `
        SELECT
          p.id AS product_id,
          p.title AS product_title,
          p.slug AS product_slug,
          COALESCE(subscribers.subscribers_count, 0) AS subscribers_count,
          COALESCE(notifications.sent_count, 0) AS sent_count,
          COALESCE(conversions.orders_count, 0) AS orders_count,
          COALESCE(conversions.sales_amount, 0)::float8 AS sales_amount
        FROM products p
        LEFT JOIN (
          SELECT product_id, COUNT(*)::int AS subscribers_count
          FROM product_restock_subscriptions
          WHERE store_id = $1
            AND is_active = TRUE
          GROUP BY product_id
        ) subscribers ON subscribers.product_id = p.id
        LEFT JOIN (
          SELECT product_id, COUNT(*)::int AS sent_count
          FROM product_restock_notifications
          WHERE store_id = $1
          GROUP BY product_id
        ) notifications ON notifications.product_id = p.id
        LEFT JOIN (
          SELECT
            product_id,
            COUNT(*) FILTER (WHERE created_order_id IS NOT NULL)::int AS orders_count,
            COALESCE(SUM(conversion_amount), 0)::float8 AS sales_amount
          FROM product_restock_notifications
          WHERE store_id = $1
          GROUP BY product_id
        ) conversions ON conversions.product_id = p.id
        WHERE p.store_id = $1
          AND (
            $2::text IS NULL
            OR p.title ILIKE '%' || $2 || '%'
            OR p.slug ILIKE '%' || $2 || '%'
          )
        ORDER BY sent_count DESC, subscribers_count DESC, p.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [input.storeId, input.q, input.limit, input.offset],
    );

    return result.rows;
  }

  async countRestockProductStats(input: { storeId: string; q: string | null }): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM products p
        WHERE p.store_id = $1
          AND (
            $2::text IS NULL
            OR p.title ILIKE '%' || $2 || '%'
            OR p.slug ILIKE '%' || $2 || '%'
          )
      `,
      [input.storeId, input.q],
    );

    return Number(result.rows[0]?.total ?? '0');
  }
}
