import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { PaymentMethod, PaymentStatus } from './constants/payment.constants';
import type { QueryExecutor } from '../database/query-executor';

export interface PaymentRecord {
  id: string;
  store_id: string;
  order_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string;
  paid_amount: string;
  refunded_amount: string;
  currency_code: string;
  version: string;
  submission_version: number;
  store_payment_method_id: string | null;
  payment_method_catalog_id: string | null;
  payment_method_code: string | null;
  payment_method_name: string | null;
  account_name: string | null;
  account_number: string | null;
  phone_number: string | null;
  iban: string | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  payer_reference: string | null;
  payer_receipt_url: string | null;
  payer_receipt_media_asset_id: string | null;
  payer_note: string | null;
  customer_submitted_at: Date | null;
  receipt_url: string | null;
  receipt_media_asset_id: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_note: string | null;
  customer_uploaded_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentWithOrder extends PaymentRecord {
  order_code: string;
  order_status: string;
  order_total: string;
  order_currency_code: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  fulfillment_status: string;
}

const PAYMENT_SELECT_FIELDS = `
  id, store_id, order_id, method, status, amount, paid_amount, refunded_amount,
  currency_code, version::text, submission_version,
  store_payment_method_id, payment_method_catalog_id, payment_method_code, payment_method_name,
  account_name, account_number, phone_number, iban, instructions_ar, instructions_en,
  payer_reference, payer_receipt_url, payer_receipt_media_asset_id, payer_note, customer_submitted_at,
  receipt_url, receipt_media_asset_id, reviewed_at, reviewed_by, review_note,
  customer_uploaded_at, expires_at, created_at, updated_at
`;

const PAYMENT_SELECT_FIELDS_PREFIXED = `
  p.id, p.store_id, p.order_id, p.method, p.status, p.amount, p.paid_amount, p.refunded_amount,
  p.currency_code, p.version::text, p.submission_version,
  p.store_payment_method_id, p.payment_method_catalog_id, p.payment_method_code, p.payment_method_name,
  p.account_name, p.account_number, p.phone_number, p.iban, p.instructions_ar, p.instructions_en,
  p.payer_reference, p.payer_receipt_url, p.payer_receipt_media_asset_id, p.payer_note, p.customer_submitted_at,
  p.receipt_url, p.receipt_media_asset_id, p.reviewed_at, p.reviewed_by, p.review_note,
  p.customer_uploaded_at, p.expires_at, p.created_at, p.updated_at
`;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async withTransaction<T>(callback: (db: QueryExecutor) => Promise<T>): Promise<T> {
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

  async findByOrderId(storeId: string, orderId: string): Promise<PaymentRecord | null> {
    const result = await this.databaseService.db.query<PaymentRecord>(
      `
        SELECT ${PAYMENT_SELECT_FIELDS}
        FROM payments
        WHERE store_id = $1 AND order_id = $2
        LIMIT 1
      `,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async findById(storeId: string, paymentId: string): Promise<PaymentRecord | null> {
    const result = await this.databaseService.db.query<PaymentRecord>(
      `
        SELECT ${PAYMENT_SELECT_FIELDS}
        FROM payments
        WHERE store_id = $1 AND id = $2
        LIMIT 1
      `,
      [storeId, paymentId],
    );
    return result.rows[0] ?? null;
  }

  async findByIdInTransaction(
    db: QueryExecutor,
    storeId: string,
    paymentId: string,
  ): Promise<PaymentRecord | null> {
    const result = await db.query<PaymentRecord>(
      `SELECT ${PAYMENT_SELECT_FIELDS} FROM payments
       WHERE store_id = $1 AND id = $2 LIMIT 1`,
      [storeId, paymentId],
    );
    return result.rows[0] ?? null;
  }

  async findByOrderIdInTransaction(
    db: QueryExecutor,
    storeId: string,
    orderId: string,
  ): Promise<PaymentRecord | null> {
    const result = await db.query<PaymentRecord>(
      `SELECT ${PAYMENT_SELECT_FIELDS} FROM payments
       WHERE store_id = $1 AND order_id = $2 LIMIT 1`,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }

  async listByStore(
    storeId: string,
    filters: { orderId?: string; status?: PaymentStatus; limit: number; offset: number },
  ): Promise<{ rows: PaymentWithOrder[]; total: number }> {
    const conditions: string[] = ['p.store_id = $1'];
    const values: unknown[] = [storeId];
    let paramIndex = 2;

    if (filters?.orderId) {
      conditions.push(`p.order_id = $${paramIndex}`);
      values.push(filters.orderId);
      paramIndex++;
    }

    if (filters?.status) {
      conditions.push(`p.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    values.push(filters.limit,filters.offset);
    const limitParameter=`$${values.length-1}`; const offsetParameter=`$${values.length}`;
    const result = await this.databaseService.db.query<PaymentWithOrder>(
      `
        SELECT ${PAYMENT_SELECT_FIELDS_PREFIXED},
               o.order_code, o.status AS order_status, o.fulfillment_status,
               o.total AS order_total,
               o.currency_code AS order_currency_code,
               o.customer_id,
               c.full_name AS customer_name, c.phone AS customer_phone
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at DESC,p.id DESC LIMIT ${limitParameter} OFFSET ${offsetParameter}
      `,
      values,
    );

    const countValues=values.slice(0,-2);
    const count=await this.databaseService.db.query<{total:string}>(
      `SELECT COUNT(*)::text total FROM payments p WHERE ${conditions.join(' AND ')}`,countValues);
    return {rows:result.rows,total:Number(count.rows[0]?.total??'0')};
  }

  async listPendingReview(storeId: string): Promise<PaymentWithOrder[]> {
    const result = await this.databaseService.db.query<PaymentWithOrder>(
      `
        SELECT ${PAYMENT_SELECT_FIELDS_PREFIXED},
               o.order_code, o.status AS order_status, o.fulfillment_status,
               o.total AS order_total,
               o.currency_code AS order_currency_code,
               o.customer_id,
               c.full_name AS customer_name, c.phone AS customer_phone
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE p.store_id = $1
          AND p.status = 'under_review'
        ORDER BY p.customer_uploaded_at ASC NULLS LAST, p.created_at ASC
      `,
      [storeId],
    );

    return result.rows;
  }

  async updateReceiptInTransaction(db: QueryExecutor, input: {
    paymentId: string;
    storeId: string;
    receiptMediaAssetId: string;
    receiptUrl: string;
  }): Promise<PaymentRecord | null> {
    const result = await db.query<PaymentRecord>(
      `
        UPDATE payments
        SET receipt_media_asset_id = $3,
            receipt_url = $4,
            payer_receipt_media_asset_id = $3,
            payer_receipt_url = $4,
            customer_uploaded_at = NOW(),
            customer_submitted_at = COALESCE(customer_submitted_at, NOW()),
            status = 'under_review',
            status_version = status_version + 1,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
          AND method <> 'cod'
          AND status = ANY($5::text[])
        RETURNING ${PAYMENT_SELECT_FIELDS}
      `,
      [input.paymentId, input.storeId, input.receiptMediaAssetId, input.receiptUrl,
       ['pending', 'rejected']],
    );
    return result.rows[0] ?? null;
  }

  async updateStatusInTransaction(
    db: QueryExecutor,
    input: {
      paymentId: string;
      storeId: string;
      status: PaymentStatus;
      allowedPreviousStatuses: PaymentStatus[];
      reviewedBy: string | null;
      reviewNote: string | null;
    },
  ): Promise<PaymentRecord | null> {
    const result = await db.query<PaymentRecord>(
      `UPDATE payments
       SET status = $3, reviewed_by = COALESCE($5, reviewed_by),
           review_note = COALESCE($6, review_note),
           reviewed_at = CASE WHEN $3 IN ('approved', 'rejected') THEN NOW() ELSE reviewed_at END,
           status_version = status_version + 1, updated_at = NOW()
       WHERE id = $1 AND store_id = $2 AND status = ANY($4::text[])
       RETURNING ${PAYMENT_SELECT_FIELDS}`,
      [input.paymentId, input.storeId, input.status, input.allowedPreviousStatuses,
       input.reviewedBy, input.reviewNote],
    );
    return result.rows[0] ?? null;
  }

  async insertStatusHistory(
    db: QueryExecutor,
    input: {
      storeId: string;
      paymentId: string;
      orderId: string;
      fromStatus: PaymentStatus;
      toStatus: PaymentStatus;
      reviewedBy: string | null;
      reviewNote: string | null;
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO payment_status_history (
         id, store_id, payment_id, order_id, from_status, to_status,
         reviewed_by, review_note, business_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (store_id, business_key) DO NOTHING`,
      [uuidv4(), input.storeId, input.paymentId, input.orderId, input.fromStatus,
       input.toStatus, input.reviewedBy, input.reviewNote,
       `payment:${input.paymentId}:${input.fromStatus}:${input.toStatus}`],
    );
  }

  async create(input: {
    storeId: string;
    orderId: string;
    method: PaymentMethod;
    amount: number;
  }): Promise<PaymentRecord> {
    const id = uuidv4();
    const result = await this.databaseService.db.query<PaymentRecord>(
      `
        INSERT INTO payments (
          id, store_id, order_id, method, status, amount,
          payment_method_code, payment_method_name
        )
        VALUES (
          $1, $2, $3, $4, 'pending', $5, $4,
          CASE $4 WHEN 'cod' THEN 'الدفع عند الاستلام' WHEN 'transfer' THEN 'تحويل بنكي' ELSE $4 END
        )
        RETURNING ${PAYMENT_SELECT_FIELDS}
      `,
      [id, input.storeId, input.orderId, input.method, input.amount],
    );
    return result.rows[0]!;
  }

  async markCollectedInTransaction(db: QueryExecutor, input: {
    paymentId: string;
    storeId: string;
    reviewedBy: string;
  }): Promise<PaymentRecord | null> {
    const result = await db.query<PaymentRecord>(
      `
        UPDATE payments
        SET status = 'approved',
            reviewed_by = $3,
            reviewed_at = NOW(),
            review_note = COALESCE(review_note, 'COD collected'),
            status_version = status_version + 1,
            updated_at = NOW()
        WHERE id = $1
          AND store_id = $2
          AND COALESCE(payment_method_code, method) = 'cod'
          AND status = 'pending'
        RETURNING ${PAYMENT_SELECT_FIELDS}
      `,
      [input.paymentId, input.storeId, input.reviewedBy],
    );
    return result.rows[0] ?? null;
  }

  async findWithOrderById(storeId: string, paymentId: string): Promise<PaymentWithOrder | null> {
    const result = await this.databaseService.db.query<PaymentWithOrder>(
      `
        SELECT ${PAYMENT_SELECT_FIELDS_PREFIXED},
               o.order_code, o.status AS order_status, o.fulfillment_status,
               o.total AS order_total,
               o.currency_code AS order_currency_code,
               o.customer_id,
               c.full_name AS customer_name, c.phone AS customer_phone
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE p.store_id = $1 AND p.id = $2
        LIMIT 1
      `,
      [storeId, paymentId],
    );
    return result.rows[0] ?? null;
  }

  async findWithOrderByOrderId(storeId: string, orderId: string): Promise<PaymentWithOrder | null> {
    const result = await this.databaseService.db.query<PaymentWithOrder>(
      `SELECT ${PAYMENT_SELECT_FIELDS_PREFIXED},
              o.order_code, o.status AS order_status, o.fulfillment_status,
              o.total AS order_total, o.currency_code AS order_currency_code,
              o.customer_id, c.full_name AS customer_name, c.phone AS customer_phone
       FROM payments p
       INNER JOIN orders o ON o.id = p.order_id AND o.store_id = p.store_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE p.store_id = $1 AND p.order_id = $2
       LIMIT 1`,
      [storeId, orderId],
    );
    return result.rows[0] ?? null;
  }
}
