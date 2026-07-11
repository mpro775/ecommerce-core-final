import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { PaymentMethodType } from './constants/payment-method.constants';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface PlatformPaymentMethodRecord {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon_url: string | null;
  media_asset_id: string | null;
  type: PaymentMethodType;
  requires_reference: boolean;
  requires_receipt: boolean;
  is_receipt_optional: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface StorePaymentMethodRecord {
  id: string;
  store_id: string;
  platform_payment_method_id: string;
  is_enabled: boolean;
  account_name: string | null;
  account_number: string | null;
  phone_number: string | null;
  iban: string | null;
  instructions_ar: string | null;
  instructions_en: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  platform_code: string;
  platform_name_ar: string;
  platform_name_en: string;
  platform_description_ar: string | null;
  platform_description_en: string | null;
  platform_icon_url: string | null;
  platform_media_asset_id: string | null;
  platform_type: PaymentMethodType;
  requires_reference: boolean;
  requires_receipt: boolean;
  is_receipt_optional: boolean;
  platform_is_enabled: boolean;
  platform_sort_order: number;
}

export interface StorefrontPaymentMethodRecord extends StorePaymentMethodRecord {}

export interface PaymentMethodSnapshot {
  storePaymentMethodId: string;
  platformPaymentMethodId: string;
  methodCode: string;
  methodName: string;
  type: PaymentMethodType;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  requiresReference: boolean;
  requiresReceipt: boolean;
  isReceiptOptional: boolean;
}

const PLATFORM_FIELDS = `
  id, code, name_ar, name_en, description_ar, description_en, icon_url, media_asset_id, type,
  requires_reference, requires_receipt, is_receipt_optional, is_enabled,
  sort_order, created_at, updated_at
`;

const STORE_FIELDS = `
  spm.id,
  spm.store_id,
  spm.platform_payment_method_id,
  spm.is_enabled,
  spm.account_name,
  spm.account_number,
  spm.phone_number,
  spm.iban,
  spm.instructions_ar,
  spm.instructions_en,
  spm.sort_order,
  spm.created_at,
  spm.updated_at,
  ppm.code AS platform_code,
  ppm.name_ar AS platform_name_ar,
  ppm.name_en AS platform_name_en,
  ppm.description_ar AS platform_description_ar,
  ppm.description_en AS platform_description_en,
   ppm.icon_url AS platform_icon_url,
   ppm.media_asset_id AS platform_media_asset_id,
   ppm.type AS platform_type,
  ppm.requires_reference,
  ppm.requires_receipt,
  ppm.is_receipt_optional,
  ppm.is_enabled AS platform_is_enabled,
  ppm.sort_order AS platform_sort_order
`;

@Injectable()
export class PaymentMethodsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPlatform(includeDisabled = true): Promise<PlatformPaymentMethodRecord[]> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        SELECT ${PLATFORM_FIELDS}
        FROM platform_payment_methods
        WHERE $1::boolean OR is_enabled = TRUE
        ORDER BY sort_order ASC, created_at ASC
      `,
      [includeDisabled],
    );
    return result.rows;
  }

  async findPlatformById(id: string): Promise<PlatformPaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        SELECT ${PLATFORM_FIELDS}
        FROM platform_payment_methods
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findPlatformByCode(code: string): Promise<PlatformPaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        SELECT ${PLATFORM_FIELDS}
        FROM platform_payment_methods
        WHERE code = $1
        LIMIT 1
      `,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async createPlatform(input: {
    code: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string | null;
    descriptionEn: string | null;
    mediaAssetId: string | null;
    type: PaymentMethodType;
    requiresReference: boolean;
    requiresReceipt: boolean;
    isReceiptOptional: boolean;
    isEnabled: boolean;
    sortOrder: number;
  }): Promise<PlatformPaymentMethodRecord> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        INSERT INTO platform_payment_methods (
          id, code, name_ar, name_en, description_ar, description_en, media_asset_id,
          type, requires_reference, requires_receipt, is_receipt_optional,
          is_enabled, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING ${PLATFORM_FIELDS}
      `,
      [
        uuidv4(),
        input.code,
        input.nameAr,
        input.nameEn,
        input.descriptionAr,
        input.descriptionEn,
        input.mediaAssetId,
        input.type,
        input.requiresReference,
        input.requiresReceipt,
        input.isReceiptOptional,
        input.isEnabled,
        input.sortOrder,
      ],
    );
    return result.rows[0]!;
  }

  async updatePlatform(
    id: string,
    input: {
      code: string;
      nameAr: string;
      nameEn: string;
      descriptionAr: string | null;
      descriptionEn: string | null;
      mediaAssetId: string | null;
      type: PaymentMethodType;
      requiresReference: boolean;
      requiresReceipt: boolean;
      isReceiptOptional: boolean;
      isEnabled: boolean;
      sortOrder: number;
    },
  ): Promise<PlatformPaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        UPDATE platform_payment_methods
        SET code = $2,
            name_ar = $3,
            name_en = $4,
            description_ar = $5,
            description_en = $6,
            media_asset_id = $7,
            type = $8,
            requires_reference = $9,
            requires_receipt = $10,
            is_receipt_optional = $11,
            is_enabled = $12,
            sort_order = $13,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${PLATFORM_FIELDS}
      `,
      [
        id,
        input.code,
        input.nameAr,
        input.nameEn,
        input.descriptionAr,
        input.descriptionEn,
        input.mediaAssetId,
        input.type,
        input.requiresReference,
        input.requiresReceipt,
        input.isReceiptOptional,
        input.isEnabled,
        input.sortOrder,
      ],
    );
    return result.rows[0] ?? null;
  }

  async togglePlatform(
    id: string,
    isEnabled: boolean,
  ): Promise<PlatformPaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<PlatformPaymentMethodRecord>(
      `
        UPDATE platform_payment_methods
        SET is_enabled = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${PLATFORM_FIELDS}
      `,
      [id, isEnabled],
    );
    return result.rows[0] ?? null;
  }

  async countPlatformUsage(id: string): Promise<number> {
    const result = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT (
          (SELECT COUNT(*) FROM store_payment_methods WHERE platform_payment_method_id = $1)
          + (SELECT COUNT(*) FROM payments WHERE platform_payment_method_id = $1)
        )::text AS total
      `,
      [id],
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  async deletePlatform(id: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      'DELETE FROM platform_payment_methods WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listStore(storeId: string): Promise<StorePaymentMethodRecord[]> {
    const result = await this.databaseService.db.query<StorePaymentMethodRecord>(
      `
        SELECT ${STORE_FIELDS}
        FROM store_payment_methods spm
        INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
        WHERE spm.store_id = $1
        ORDER BY spm.sort_order ASC, ppm.sort_order ASC, spm.created_at ASC
      `,
      [storeId],
    );
    return result.rows;
  }

  async listStorefront(storeId: string): Promise<StorefrontPaymentMethodRecord[]> {
    const result = await this.databaseService.db.query<StorefrontPaymentMethodRecord>(
      `
        SELECT ${STORE_FIELDS}
        FROM store_payment_methods spm
        INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
        WHERE spm.store_id = $1
          AND spm.is_enabled = TRUE
          AND ppm.is_enabled = TRUE
        ORDER BY spm.sort_order ASC, ppm.sort_order ASC, spm.created_at ASC
      `,
      [storeId],
    );
    return result.rows;
  }

  async findStoreById(storeId: string, id: string): Promise<StorePaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<StorePaymentMethodRecord>(
      `
        SELECT ${STORE_FIELDS}
        FROM store_payment_methods spm
        INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
        WHERE spm.store_id = $1
          AND spm.id = $2
        LIMIT 1
      `,
      [storeId, id],
    );
    return result.rows[0] ?? null;
  }

  async findEnabledStoreById(
    storeId: string,
    id: string,
  ): Promise<StorePaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<StorePaymentMethodRecord>(
      `
        SELECT ${STORE_FIELDS}
        FROM store_payment_methods spm
        INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
        WHERE spm.store_id = $1
          AND spm.id = $2
          AND spm.is_enabled = TRUE
          AND ppm.is_enabled = TRUE
        LIMIT 1
      `,
      [storeId, id],
    );
    return result.rows[0] ?? null;
  }

  async findStoreByPlatformId(
    storeId: string,
    platformPaymentMethodId: string,
  ): Promise<StorePaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<StorePaymentMethodRecord>(
      `
        SELECT ${STORE_FIELDS}
        FROM store_payment_methods spm
        INNER JOIN platform_payment_methods ppm ON ppm.id = spm.platform_payment_method_id
        WHERE spm.store_id = $1
          AND spm.platform_payment_method_id = $2
        LIMIT 1
      `,
      [storeId, platformPaymentMethodId],
    );
    return result.rows[0] ?? null;
  }

  async createStore(input: {
    storeId: string;
    platformPaymentMethodId: string;
    isEnabled: boolean;
    sortOrder: number;
  }): Promise<StorePaymentMethodRecord> {
    const result = await this.databaseService.db.query<StorePaymentMethodRecord>(
      `
        INSERT INTO store_payment_methods (
          id, store_id, platform_payment_method_id, is_enabled, sort_order
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (store_id, platform_payment_method_id)
        DO UPDATE SET updated_at = NOW()
        RETURNING id
      `,
      [uuidv4(), input.storeId, input.platformPaymentMethodId, input.isEnabled, input.sortOrder],
    );
    return (await this.findStoreById(input.storeId, result.rows[0]!.id))!;
  }

  async updateStore(
    storeId: string,
    id: string,
    input: {
      isEnabled: boolean;
      accountName: string | null;
      accountNumber: string | null;
      phoneNumber: string | null;
      iban: string | null;
      instructionsAr: string | null;
      instructionsEn: string | null;
      sortOrder: number;
    },
  ): Promise<StorePaymentMethodRecord | null> {
    const result = await this.databaseService.db.query<{ id: string }>(
      `
        UPDATE store_payment_methods
        SET is_enabled = $3,
            account_name = $4,
            account_number = $5,
            phone_number = $6,
            iban = $7,
            instructions_ar = $8,
            instructions_en = $9,
            sort_order = $10,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        storeId,
        id,
        input.isEnabled,
        input.accountName,
        input.accountNumber,
        input.phoneNumber,
        input.iban,
        input.instructionsAr,
        input.instructionsEn,
        input.sortOrder,
      ],
    );
    if (!result.rows[0]) {
      return null;
    }
    return this.findStoreById(storeId, id);
  }

  async createPayment(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      amount: number;
      amountYER?: number;
      status: 'pending' | 'under_review';
      snapshot: PaymentMethodSnapshot;
      payerReference: string | null;
      payerReceiptMediaAssetId: string | null;
      payerReceiptUrl: string | null;
      payerNote: string | null;
    },
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO payments (
          id, store_id, order_id, method, status, amount, amount_yer,
          store_payment_method_id, platform_payment_method_id,
          payment_method_code, payment_method_name,
          account_name, account_number, phone_number, iban,
          instructions_ar, instructions_en,
          payer_reference, payer_receipt_media_asset_id, payer_receipt_url,
          receipt_media_asset_id, receipt_url, payer_note, customer_submitted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17,
          $18, $19, $20,
          $19, $20, $21, $22
        )
      `,
      [
        uuidv4(),
        input.storeId,
        input.orderId,
        input.snapshot.methodCode,
        input.status,
        input.amount,
        input.amountYER ?? input.amount,
        input.snapshot.storePaymentMethodId,
        input.snapshot.platformPaymentMethodId,
        input.snapshot.methodCode,
        input.snapshot.methodName,
        input.snapshot.accountName,
        input.snapshot.accountNumber,
        input.snapshot.phoneNumber,
        input.snapshot.iban,
        input.snapshot.instructionsAr,
        input.snapshot.instructionsEn,
        input.payerReference,
        input.payerReceiptMediaAssetId,
        input.payerReceiptUrl,
        input.payerNote,
        input.status === 'under_review' ? new Date() : null,
      ],
    );
  }
}
