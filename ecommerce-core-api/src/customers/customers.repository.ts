import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface CustomerRecord {
  id: string;
  store_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  email_normalized: string | null;
  password_hash: string | null;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  gender: 'male' | 'female' | null;
  country: string | null;
  city: string | null;
  birth_date: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerSessionRecord {
  id: string;
  customer_id: string;
  store_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface CustomerPasswordResetRecord {
  id: string;
  customer_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}

export interface CustomerAddressRecord {
  id: string;
  customer_id: string;
  store_id: string;
  address_line: string;
  city: string | null;
  area: string | null;
  notes: string | null;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  map_provider: string | null;
  place_label: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WishlistRecord {
  id: string;
  customer_id: string;
  store_id: string;
  product_id: string;
  created_at: Date;
}

export interface WishlistProductRecord {
  id: string;
  product_id: string;
  title: string;
  slug: string;
  primary_image_url: string | null;
  price_from: number | null;
  created_at: Date;
}

export interface ProductReviewRecord {
  id: string;
  store_id: string;
  product_id: string;
  product_title: string | null;
  customer_id: string;
  customer_name: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  is_verified_purchase: boolean;
  moderation_status: 'PENDING' | 'APPROVED' | 'HIDDEN';
  created_at: Date;
  updated_at: Date;
}

export interface ProductReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: { rating: number; count: number }[];
}

export interface ManagedCustomerSummaryRecord {
  id: string;
  store_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  gender: 'male' | 'female' | null;
  country: string | null;
  city: string | null;
  birth_date: Date | null;
  is_active: boolean;
  created_at: Date;
  last_login_at: Date | null;
  orders_count: string;
  total_spent: string;
}

export interface ManagedCustomerAbandonedCartRecord {
  id: string;
  cart_data: Record<string, unknown>;
  cart_total: number;
  items_count: number;
  recovery_sent_at: Date | null;
  recovered_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

const CUSTOMER_SELECT_FIELDS = `
  id, store_id, full_name, phone, email, email_normalized, password_hash,
  email_verified_at, last_login_at, gender, country, city, birth_date, is_active, created_at, updated_at
`;

@Injectable()
export class CustomersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByPhone(storeId: string, phone: string): Promise<CustomerRecord | null> {
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        SELECT ${CUSTOMER_SELECT_FIELDS}
        FROM customers
        WHERE store_id = $1 AND phone = $2
        LIMIT 1
      `,
      [storeId, phone],
    );
    return result.rows[0] ?? null;
  }

  async findByEmail(storeId: string, email: string): Promise<CustomerRecord | null> {
    const emailNormalized = email.trim().toLowerCase();
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        SELECT ${CUSTOMER_SELECT_FIELDS}
        FROM customers
        WHERE store_id = $1 AND LOWER(email_normalized) = $2
        LIMIT 1
      `,
      [storeId, emailNormalized],
    );
    return result.rows[0] ?? null;
  }

  async findById(customerId: string): Promise<CustomerRecord | null> {
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        SELECT ${CUSTOMER_SELECT_FIELDS}
        FROM customers
        WHERE id = $1
        LIMIT 1
      `,
      [customerId],
    );
    return result.rows[0] ?? null;
  }

  async findByIdAndStore(customerId: string, storeId: string): Promise<CustomerRecord | null> {
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        SELECT ${CUSTOMER_SELECT_FIELDS}
        FROM customers
        WHERE id = $1 AND store_id = $2
        LIMIT 1
      `,
      [customerId, storeId],
    );
    return result.rows[0] ?? null;
  }

  async createRegistered(input: {
    storeId: string;
    fullName: string;
    phone: string;
    email: string | null;
    emailNormalized: string | null;
    passwordHash: string;
  }): Promise<CustomerRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        INSERT INTO customers (id, store_id, full_name, phone, email, email_normalized, password_hash, email_verified_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING ${CUSTOMER_SELECT_FIELDS}
      `,
      [
        id,
        input.storeId,
        input.fullName,
        input.phone,
        input.email,
        input.emailNormalized,
        input.passwordHash,
      ],
    );
    return result.rows[0]!;
  }

  async createManaged(input: {
    storeId: string;
    fullName: string;
    phone: string;
    email: string | null;
    emailNormalized: string | null;
    gender: 'male' | 'female' | null;
    country: string;
    city: string | null;
    birthDate: Date | null;
  }): Promise<CustomerRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        INSERT INTO customers (
          id,
          store_id,
          full_name,
          phone,
          email,
          email_normalized,
          gender,
          country,
          city,
          birth_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING ${CUSTOMER_SELECT_FIELDS}
      `,
      [
        id,
        input.storeId,
        input.fullName,
        input.phone,
        input.email,
        input.emailNormalized,
        input.gender,
        input.country,
        input.city,
        input.birthDate,
      ],
    );
    return result.rows[0]!;
  }

  async listManagedCustomers(input: {
    storeId: string;
    q: string | null;
    limit: number;
    offset: number;
  }): Promise<ManagedCustomerSummaryRecord[]> {
    const result = await this.databaseService.db.query<ManagedCustomerSummaryRecord>(
      `
        SELECT
          c.id,
          c.store_id,
          c.full_name,
          c.phone,
          c.email,
          c.gender,
          c.country,
          c.city,
          c.birth_date,
          c.is_active,
          c.created_at,
          c.last_login_at,
          COALESCE(order_stats.orders_count, 0)::text AS orders_count,
          COALESCE(order_stats.total_spent, 0)::text AS total_spent
        FROM customers c
        LEFT JOIN (
          SELECT
            customer_id,
            COUNT(*) AS orders_count,
            SUM(total) AS total_spent
          FROM orders
          WHERE store_id = $1
          GROUP BY customer_id
        ) order_stats ON order_stats.customer_id = c.id
        WHERE c.store_id = $1
          AND (
            $2::text IS NULL
            OR c.full_name ILIKE '%' || $2 || '%'
            OR c.phone ILIKE '%' || $2 || '%'
            OR COALESCE(c.email, '') ILIKE '%' || $2 || '%'
          )
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [input.storeId, input.q, input.limit, input.offset],
    );
    return result.rows;
  }

  async countManagedCustomers(storeId: string, q: string | null): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM customers c
        WHERE c.store_id = $1
          AND (
            $2::text IS NULL
            OR c.full_name ILIKE '%' || $2 || '%'
            OR c.phone ILIKE '%' || $2 || '%'
            OR COALESCE(c.email, '') ILIKE '%' || $2 || '%'
          )
      `,
      [storeId, q],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async updateManaged(input: {
    customerId: string;
    storeId: string;
    fullName?: string;
    phone?: string;
    email?: string | null;
    emailNormalized?: string | null;
    gender?: 'male' | 'female' | null;
    country?: string;
    city?: string | null;
    birthDate?: Date | null;
  }): Promise<CustomerRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(input.fullName);
    }

    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }

    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(input.email);
      updates.push(`email_normalized = $${paramIndex++}`);
      values.push(input.emailNormalized ?? null);
    }

    if (input.gender !== undefined) {
      updates.push(`gender = $${paramIndex++}`);
      values.push(input.gender);
    }

    if (input.country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      values.push(input.country);
    }

    if (input.city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(input.city);
    }

    if (input.birthDate !== undefined) {
      updates.push(`birth_date = $${paramIndex++}`);
      values.push(input.birthDate);
    }

    if (updates.length === 0) {
      return this.findByIdAndStore(input.customerId, input.storeId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(input.customerId, input.storeId);

    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        UPDATE customers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++}
          AND store_id = $${paramIndex}
        RETURNING ${CUSTOMER_SELECT_FIELDS}
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async updateManagedStatus(
    customerId: string,
    storeId: string,
    isActive: boolean,
  ): Promise<CustomerRecord | null> {
    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        UPDATE customers
        SET is_active = $3, updated_at = NOW()
        WHERE id = $1 AND store_id = $2
        RETURNING ${CUSTOMER_SELECT_FIELDS}
      `,
      [customerId, storeId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async updateProfile(input: {
    customerId: string;
    fullName?: string;
    phone?: string;
    email?: string | null;
    emailNormalized?: string | null;
  }): Promise<CustomerRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(input.fullName);
    }
    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }
    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(input.email);
      updates.push(`email_normalized = $${paramIndex++}`);
      values.push(input.emailNormalized);
    }

    if (updates.length === 0) {
      return this.findById(input.customerId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(input.customerId);

    const result = await this.databaseService.db.query<CustomerRecord>(
      `
        UPDATE customers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING ${CUSTOMER_SELECT_FIELDS}
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async updatePassword(customerId: string, passwordHash: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE customers
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [customerId, passwordHash],
    );
  }

  async touchLastLogin(customerId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE customers
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [customerId],
    );
  }

  async createSession(input: {
    sessionId?: string;
    customerId: string;
    storeId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<string> {
    const sessionId = input.sessionId ?? uuidv4();
    await this.databaseService.db.query(
      `
        INSERT INTO customer_sessions (id, customer_id, store_id, refresh_token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        sessionId,
        input.customerId,
        input.storeId,
        input.refreshTokenHash,
        input.expiresAt,
        input.ipAddress,
        input.userAgent,
      ],
    );
    return sessionId;
  }

  async findSessionById(sessionId: string): Promise<CustomerSessionRecord | null> {
    const result = await this.databaseService.db.query<CustomerSessionRecord>(
      `
        SELECT id, customer_id, store_id, refresh_token_hash, expires_at, revoked_at
        FROM customer_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );
    return result.rows[0] ?? null;
  }

  async rotateSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE customer_sessions
        SET refresh_token_hash = $2,
            expires_at = $3,
            rotation_counter = rotation_counter + 1,
            last_seen_at = NOW(),
            ip_address = $4,
            user_agent = $5,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.sessionId, input.refreshTokenHash, input.expiresAt, input.ipAddress, input.userAgent],
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE customer_sessions
        SET revoked_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );
  }

  async revokeAllSessionsForCustomer(customerId: string): Promise<number> {
    const result = await this.databaseService.db.query(
      `
        UPDATE customer_sessions
        SET revoked_at = NOW(), updated_at = NOW()
        WHERE customer_id = $1 AND revoked_at IS NULL
      `,
      [customerId],
    );
    return result.rowCount ?? 0;
  }

  async createPasswordReset(input: {
    customerId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = uuidv4();
    await this.databaseService.db.query(
      `
        INSERT INTO customer_password_resets (id, customer_id, token_hash, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [id, input.customerId, input.tokenHash, input.expiresAt],
    );
    return id;
  }

  async findPasswordResetByToken(tokenHash: string): Promise<CustomerPasswordResetRecord | null> {
    const result = await this.databaseService.db.query<CustomerPasswordResetRecord>(
      `
        SELECT id, customer_id, token_hash, expires_at, used_at
        FROM customer_password_resets
        WHERE token_hash = $1
        LIMIT 1
      `,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async markPasswordResetUsed(resetId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE customer_password_resets
        SET used_at = NOW()
        WHERE id = $1
      `,
      [resetId],
    );
  }

  async deleteExpiredResets(): Promise<void> {
    await this.databaseService.db.query(
      `
        DELETE FROM customer_password_resets
        WHERE expires_at < NOW() OR used_at IS NOT NULL
      `,
    );
  }

  async createAddress(input: {
    customerId: string;
    storeId: string;
    addressLine: string;
    city: string | null;
    area: string | null;
    notes: string | null;
    isDefault: boolean;
    latitude: number | null;
    longitude: number | null;
    mapProvider: string | null;
    placeLabel: string | null;
  }): Promise<CustomerAddressRecord> {
    const id = uuidv4();

    if (input.isDefault) {
      await this.databaseService.db.query(
        `
          UPDATE customer_addresses SET is_default = FALSE, updated_at = NOW()
          WHERE customer_id = $1 AND store_id = $2
        `,
        [input.customerId, input.storeId],
      );
    }

    const result = await this.databaseService.db.query<CustomerAddressRecord>(
      `
        INSERT INTO customer_addresses (
          id, customer_id, store_id, address_line, city, area, notes, is_default,
          latitude, longitude, map_provider, place_label
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, customer_id, store_id, address_line, city, area, notes, is_default,
          latitude, longitude, map_provider, place_label, created_at, updated_at
      `,
      [
        id,
        input.customerId,
        input.storeId,
        input.addressLine,
        input.city,
        input.area,
        input.notes,
        input.isDefault,
        input.latitude,
        input.longitude,
        input.mapProvider,
        input.placeLabel,
      ],
    );
    return result.rows[0]!;
  }

  async listAddresses(customerId: string, storeId: string): Promise<CustomerAddressRecord[]> {
    const result = await this.databaseService.db.query<CustomerAddressRecord>(
      `
        SELECT id, customer_id, store_id, address_line, city, area, notes, is_default,
               latitude, longitude, map_provider, place_label, created_at, updated_at
        FROM customer_addresses
        WHERE customer_id = $1 AND store_id = $2
        ORDER BY is_default DESC, created_at DESC
      `,
      [customerId, storeId],
    );
    return result.rows;
  }

  async deleteAddress(addressId: string, customerId: string, storeId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM customer_addresses
        WHERE id = $1 AND customer_id = $2 AND store_id = $3
      `,
      [addressId, customerId, storeId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== WISHLIST ====================

  async addToWishlist(
    customerId: string,
    storeId: string,
    productId: string,
  ): Promise<WishlistRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<WishlistRecord>(
      `
        INSERT INTO customer_wishlists (id, customer_id, store_id, product_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (customer_id, product_id) DO UPDATE SET created_at = NOW()
        RETURNING id, customer_id, store_id, product_id, created_at
      `,
      [id, customerId, storeId, productId],
    );
    return result.rows[0]!;
  }

  async removeFromWishlist(
    customerId: string,
    storeId: string,
    productId: string,
  ): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM customer_wishlists
        WHERE customer_id = $1 AND store_id = $2 AND product_id = $3
      `,
      [customerId, storeId, productId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isInWishlist(customerId: string, storeId: string, productId: string): Promise<boolean> {
    const result = await this.databaseService.db.query<{ exists: boolean }>(
      `
        SELECT EXISTS(
          SELECT 1 FROM customer_wishlists
          WHERE customer_id = $1 AND store_id = $2 AND product_id = $3
        ) AS exists
      `,
      [customerId, storeId, productId],
    );
    return Boolean(result.rows[0]?.exists);
  }

  async listWishlist(customerId: string, storeId: string): Promise<WishlistProductRecord[]> {
    const result = await this.databaseService.db.query<WishlistProductRecord>(
      `
        SELECT 
          w.id,
          w.product_id,
          p.title,
          p.slug,
          (
            SELECT ma.public_url
            FROM product_images pi
            JOIN media_assets ma ON ma.id = pi.media_asset_id
            WHERE pi.product_id = p.id AND pi.store_id = p.store_id
            ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
            LIMIT 1
          ) AS primary_image_url,
          (
            SELECT MIN(pv.price) 
            FROM product_variants pv 
            WHERE pv.product_id = p.id AND pv.store_id = p.store_id
          ) AS price_from,
          w.created_at
        FROM customer_wishlists w
        JOIN products p ON p.id = w.product_id AND p.store_id = w.store_id
        WHERE w.customer_id = $1 AND w.store_id = $2 AND p.status = 'active'
        ORDER BY w.created_at DESC
      `,
      [customerId, storeId],
    );
    return result.rows;
  }

  // ==================== REVIEWS ====================

  async createReview(input: {
    storeId: string;
    productId: string;
    customerId: string;
    orderId?: string | null;
    rating: number;
    comment?: string | null;
    isVerifiedPurchase: boolean;
  }): Promise<ProductReviewRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        INSERT INTO product_reviews (
          id,
          store_id,
          product_id,
          customer_id,
          order_id,
          rating,
          comment,
          is_verified_purchase,
          moderation_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING id, store_id, product_id, customer_id, 
                  (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
                  (SELECT title FROM products WHERE id = product_id) AS product_title,
                  order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
      `,
      [
        id,
        input.storeId,
        input.productId,
        input.customerId,
        input.orderId ?? null,
        input.rating,
        input.comment ?? null,
        input.isVerifiedPurchase,
      ],
    );
    return result.rows[0]!;
  }

  async updateReview(input: {
    reviewId: string;
    customerId: string;
    rating?: number;
    comment?: string | null;
  }): Promise<ProductReviewRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.rating !== undefined) {
      updates.push(`rating = $${paramIndex++}`);
      values.push(input.rating);
    }
    if (input.comment !== undefined) {
      updates.push(`comment = $${paramIndex++}`);
      values.push(input.comment);
    }

    if (updates.length === 0) {
      return this.findReviewById(input.reviewId, input.customerId);
    }

    updates.push(`moderation_status = 'PENDING'`);
    updates.push(`updated_at = NOW()`);
    values.push(input.reviewId, input.customerId);

    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        UPDATE product_reviews
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND customer_id = $${paramIndex}
        RETURNING id, store_id, product_id, customer_id,
                  (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
                  (SELECT title FROM products WHERE id = product_id) AS product_title,
                  order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deleteReview(reviewId: string, customerId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        DELETE FROM product_reviews
        WHERE id = $1 AND customer_id = $2
      `,
      [reviewId, customerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findReviewById(reviewId: string, customerId: string): Promise<ProductReviewRecord | null> {
    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        SELECT id, store_id, product_id, customer_id,
               (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
               (SELECT title FROM products WHERE id = product_id) AS product_title,
               order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
        FROM product_reviews
        WHERE id = $1 AND customer_id = $2
        LIMIT 1
      `,
      [reviewId, customerId],
    );
    return result.rows[0] ?? null;
  }

  async findCustomerReviewForProduct(
    customerId: string,
    productId: string,
  ): Promise<ProductReviewRecord | null> {
    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        SELECT id, store_id, product_id, customer_id,
               (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
               (SELECT title FROM products WHERE id = product_id) AS product_title,
               order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
        FROM product_reviews
        WHERE customer_id = $1 AND product_id = $2
        LIMIT 1
      `,
      [customerId, productId],
    );
    return result.rows[0] ?? null;
  }

  async listCustomerReviews(customerId: string, storeId: string): Promise<ProductReviewRecord[]> {
    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        SELECT id, store_id, product_id, customer_id,
               (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
               (SELECT title FROM products WHERE id = product_id) AS product_title,
               order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
        FROM product_reviews
        WHERE customer_id = $1 AND store_id = $2
        ORDER BY created_at DESC
      `,
      [customerId, storeId],
    );
    return result.rows;
  }

  async listProductReviews(
    storeId: string,
    productId: string,
    limit = 20,
    offset = 0,
  ): Promise<ProductReviewRecord[]> {
    const result = await this.databaseService.db.query<
      ProductReviewRecord & { customer_name: string }
    >(
      `
        SELECT id, store_id, product_id, customer_id,
               (SELECT full_name FROM customers WHERE id = customer_id) AS customer_name,
               (SELECT title FROM products WHERE id = product_id) AS product_title,
               order_id, rating, comment, is_verified_purchase, moderation_status, created_at, updated_at
        FROM product_reviews
        WHERE store_id = $1 AND product_id = $2
          AND moderation_status = 'APPROVED'
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [storeId, productId, limit, offset],
    );
    return result.rows;
  }

  async getProductReviewStats(storeId: string, productId: string): Promise<ProductReviewStats> {
    const statsResult = await this.databaseService.db.query<{ avg: string; count: string }>(
      `
        SELECT AVG(rating) AS avg, COUNT(*) AS count
        FROM product_reviews
        WHERE store_id = $1
          AND product_id = $2
          AND moderation_status = 'APPROVED'
      `,
      [storeId, productId],
    );

    const distResult = await this.databaseService.db.query<{ rating: number; count: string }>(
      `
        SELECT rating, COUNT(*) AS count
        FROM product_reviews
        WHERE store_id = $1
          AND product_id = $2
          AND moderation_status = 'APPROVED'
        GROUP BY rating
        ORDER BY rating DESC
      `,
      [storeId, productId],
    );

    return {
      average_rating: parseFloat(statsResult.rows[0]?.avg ?? '0'),
      total_reviews: parseInt(statsResult.rows[0]?.count ?? '0', 10),
      rating_distribution: distResult.rows.map((r) => ({
        rating: r.rating,
        count: parseInt(r.count, 10),
      })),
    };
  }

  async checkCustomerPurchasedProduct(
    customerId: string,
    storeId: string,
    productId: string,
  ): Promise<string | null> {
    const result = await this.databaseService.db.query<{ order_id: string }>(
      `
        SELECT o.id AS order_id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.customer_id = $1 
          AND o.store_id = $2 
          AND oi.product_id = $3
          AND o.status IN ('completed')
        LIMIT 1
      `,
      [customerId, storeId, productId],
    );
    return result.rows[0]?.order_id ?? null;
  }

  async listCustomerOrders(
    customerId: string,
    storeId: string,
    limit = 20,
    offset = 0,
  ): Promise<OrderRecord[]> {
    const result = await this.databaseService.db.query<OrderRecord>(
      `
        SELECT id, store_id, customer_id, order_code, status, subtotal, total, 
               shipping_zone_id, shipping_fee, discount_total, coupon_code, 
               currency_code, note, shipping_address, created_at, updated_at
        FROM orders
        WHERE customer_id = $1 AND store_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [customerId, storeId, limit, offset],
    );
    return result.rows;
  }

  async listCustomerAbandonedCarts(
    customerId: string,
    storeId: string,
    limit = 30,
  ): Promise<ManagedCustomerAbandonedCartRecord[]> {
    const result = await this.databaseService.db.query<ManagedCustomerAbandonedCartRecord>(
      `
        SELECT
          id,
          cart_data,
          cart_total,
          items_count,
          recovery_sent_at,
          recovered_at,
          expires_at,
          created_at
        FROM abandoned_carts
        WHERE customer_id = $1
          AND store_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [customerId, storeId, limit],
    );
    return result.rows;
  }

  async countCustomerOrders(customerId: string, storeId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM orders
        WHERE customer_id = $1 AND store_id = $2
      `,
      [customerId, storeId],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }
}

interface OrderRecord {
  id: string;
  store_id: string;
  customer_id: string;
  order_code: string;
  status: string;
  subtotal: number;
  total: number;
  shipping_zone_id: string | null;
  shipping_fee: number;
  discount_total: number;
  coupon_code: string | null;
  currency_code: string;
  note: string | null;
  shipping_address: string | null;
  created_at: Date;
  updated_at: Date;
}
