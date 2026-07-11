import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { PaymentMethodType } from './constants/payment-method.constants';
import type { UpdateStorePaymentMethodDto } from './dto/store-payment-method.dto';
import {
  PaymentMethodsRepository,
  type PaymentMethodSnapshot,
  type PaymentMethodCatalogRecord,
  type StorePaymentMethodRecord,
} from './payment-methods.repository';
import { MediaRepository } from '../media/media.repository';

export interface PaymentMethodCatalogResponse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  mediaAssetId: string | null;
  imageUrl: string | null;
  type: PaymentMethodType;
  requiresReference: boolean;
  requiresReceipt: boolean;
  isReceiptOptional: boolean;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorePaymentMethodResponse {
  id: string;
  storeId: string;
  paymentMethodCatalogId: string;
  isEnabled: boolean;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  sortOrder: number;
  platformMethod: PaymentMethodCatalogResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorefrontPaymentMethodResponse {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconUrl: string | null;
  type: PaymentMethodType;
  requiresReference: boolean;
  requiresReceipt: boolean;
  isReceiptOptional: boolean;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructions: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  sortOrder: number;
}

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly repository: PaymentMethodsRepository,
    private readonly mediaRepository: MediaRepository,
  ) {}

  async listAvailableForMerchant(): Promise<PaymentMethodCatalogResponse[]> {
    const records = await this.repository.listBaseCatalog(false);
    return Promise.all(records.map((method) => this.mapPlatform(method)));
  }

  async listStore(currentUser: AuthUser): Promise<StorePaymentMethodResponse[]> {
    const records = await this.repository.listStore(currentUser.storeId);
    return Promise.all(records.map((method) => this.mapStore(method)));
  }

  async enableStoreMethod(
    currentUser: AuthUser,
    paymentMethodCatalogId: string,
  ): Promise<StorePaymentMethodResponse> {
    const platform = await this.repository.findPlatformById(paymentMethodCatalogId);
    if (!platform || !platform.is_enabled) {
      throw new BadRequestException('طريقة الدفع غير متاحة من النظام حاليًا.');
    }
    const existing = await this.repository.findStoreByPlatformId(
      currentUser.storeId,
      paymentMethodCatalogId,
    );
    if (existing) {
      const updated = await this.repository.updateStore(currentUser.storeId, existing.id, {
        isEnabled: true,
        accountName: existing.account_name,
        accountNumber: existing.account_number,
        phoneNumber: existing.phone_number,
        iban: existing.iban,
        instructionsAr: existing.instructions_ar,
        instructionsEn: existing.instructions_en,
        sortOrder: existing.sort_order,
      });
      return await this.mapStore(updated!);
    }
    return await this.mapStore(
      await this.repository.createStore({
        storeId: currentUser.storeId,
        paymentMethodCatalogId,
        isEnabled: platform.type === 'cod',
        sortOrder: platform.sort_order,
      }),
    );
  }

  async updateStoreMethod(
    currentUser: AuthUser,
    id: string,
    input: UpdateStorePaymentMethodDto,
  ): Promise<StorePaymentMethodResponse> {
    const current = await this.requireStoreMethod(currentUser.storeId, id);
    const next = {
      isEnabled: input.isEnabled ?? current.is_enabled,
      accountName: this.normalizeOptional(input.accountName, current.account_name),
      accountNumber: this.normalizeOptional(input.accountNumber, current.account_number),
      phoneNumber: this.normalizeOptional(input.phoneNumber, current.phone_number),
      iban: this.normalizeOptional(input.iban, current.iban),
      instructionsAr: this.normalizeOptional(input.instructionsAr, current.instructions_ar),
      instructionsEn: this.normalizeOptional(input.instructionsEn, current.instructions_en),
      sortOrder: input.sortOrder ?? current.sort_order,
    };
    this.assertStoreMethodConfig(
      current.catalog_type,
      next.isEnabled,
      next.accountName,
      next.accountNumber,
    );
    if (next.isEnabled && !current.catalog_is_enabled) {
      throw new BadRequestException('طريقة الدفع غير مفعلة من النظام حاليًا.');
    }
    const updated = await this.repository.updateStore(currentUser.storeId, id, next);
    if (!updated) {
      throw new NotFoundException('Payment method not found');
    }
    return await this.mapStore(updated);
  }

  async toggleStoreMethod(
    currentUser: AuthUser,
    id: string,
    isEnabled: boolean,
  ): Promise<StorePaymentMethodResponse> {
    const current = await this.requireStoreMethod(currentUser.storeId, id);
    this.assertStoreMethodConfig(
      current.catalog_type,
      isEnabled,
      current.account_name,
      current.account_number,
    );
    if (isEnabled && !current.catalog_is_enabled) {
      throw new BadRequestException('طريقة الدفع غير مفعلة من النظام حاليًا.');
    }
    const updated = await this.repository.updateStore(currentUser.storeId, id, {
      isEnabled,
      accountName: current.account_name,
      accountNumber: current.account_number,
      phoneNumber: current.phone_number,
      iban: current.iban,
      instructionsAr: current.instructions_ar,
      instructionsEn: current.instructions_en,
      sortOrder: current.sort_order,
    });
    return await this.mapStore(updated!);
  }

  async listStorefront(storeId: string): Promise<StorefrontPaymentMethodResponse[]> {
    return (await this.repository.listStorefront(storeId)).map((method) =>
      this.mapStorefront(method),
    );
  }

  async resolveCheckoutMethod(
    storeId: string,
    storePaymentMethodId?: string,
    legacyMethod?: string,
  ): Promise<PaymentMethodSnapshot> {
    let method: StorePaymentMethodRecord | null = null;
    if (storePaymentMethodId) {
      method = await this.repository.findEnabledStoreById(storeId, storePaymentMethodId);
    } else if (legacyMethod) {
      const platformCode = legacyMethod === 'transfer' ? 'bank_transfer' : legacyMethod;
      const platform = await this.repository.findPlatformByCode(platformCode);
      if (platform) {
        method = await this.repository.findStoreByPlatformId(storeId, platform.id);
        if (method && (!method.is_enabled || !method.catalog_is_enabled)) {
          method = null;
        }
      }
    }
    if (!method) {
      throw new BadRequestException('طريقة الدفع غير متاحة لهذا المتجر.');
    }
    return this.toSnapshot(method);
  }

  private async requireStoreMethod(storeId: string, id: string): Promise<StorePaymentMethodRecord> {
    const method = await this.repository.findStoreById(storeId, id);
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }
    return method;
  }

  private assertStoreMethodConfig(
    type: PaymentMethodType,
    isEnabled: boolean,
    accountName: string | null,
    accountNumber: string | null,
  ): void {
    if (!isEnabled || type === 'cod') {
      return;
    }
    if (!accountName?.trim() || !accountNumber?.trim()) {
      throw new BadRequestException('اسم الحساب ورقم الحساب مطلوبان لتفعيل طريقة الدفع هذه.');
    }
  }

  private normalizeOptional(next: string | undefined, current: string | null): string | null {
    return next === undefined ? current : next.trim() || null;
  }

  private toSnapshot(method: StorePaymentMethodRecord): PaymentMethodSnapshot {
    return {
      storePaymentMethodId: method.id,
      paymentMethodCatalogId: method.payment_method_catalog_id,
      methodCode: method.catalog_code,
      methodName: method.catalog_name_ar || method.catalog_name_en,
      type: method.catalog_type,
      accountName: method.account_name,
      accountNumber: method.account_number,
      phoneNumber: method.phone_number,
      iban: method.iban,
      instructionsAr: method.instructions_ar,
      instructionsEn: method.instructions_en,
      requiresReference: method.requires_reference,
      requiresReceipt: method.requires_receipt,
      isReceiptOptional: method.is_receipt_optional,
    };
  }

  private async resolveImageUrl(mediaAssetId: string | null): Promise<string | null> {
    if (!mediaAssetId) return null;
    const asset = await this.mediaRepository.findById('__platform__', mediaAssetId);
    return asset?.public_url ?? null;
  }

  private async mapPlatform(
    method: PaymentMethodCatalogRecord,
  ): Promise<PaymentMethodCatalogResponse> {
    return {
      id: method.id,
      code: method.code,
      nameAr: method.name_ar,
      nameEn: method.name_en,
      descriptionAr: method.description_ar,
      descriptionEn: method.description_en,
      mediaAssetId: method.media_asset_id,
      imageUrl: await this.resolveImageUrl(method.media_asset_id),
      type: method.type,
      requiresReference: method.requires_reference,
      requiresReceipt: method.requires_receipt,
      isReceiptOptional: method.is_receipt_optional,
      isEnabled: method.is_enabled,
      sortOrder: method.sort_order,
      createdAt: method.created_at,
      updatedAt: method.updated_at,
    };
  }

  private async mapStore(method: StorePaymentMethodRecord): Promise<StorePaymentMethodResponse> {
    return {
      id: method.id,
      storeId: method.store_id,
      paymentMethodCatalogId: method.payment_method_catalog_id,
      isEnabled: method.is_enabled,
      accountName: method.account_name,
      accountNumber: method.account_number,
      phoneNumber: method.phone_number,
      iban: method.iban,
      instructionsAr: method.instructions_ar,
      instructionsEn: method.instructions_en,
      sortOrder: method.sort_order,
      platformMethod: await this.mapPlatform({
        id: method.payment_method_catalog_id,
        code: method.catalog_code,
        name_ar: method.catalog_name_ar,
        name_en: method.catalog_name_en,
        description_ar: method.catalog_description_ar,
        description_en: method.catalog_description_en,
        icon_url: method.catalog_icon_url,
        media_asset_id: method.catalog_media_asset_id,
        type: method.catalog_type,
        requires_reference: method.requires_reference,
        requires_receipt: method.requires_receipt,
        is_receipt_optional: method.is_receipt_optional,
        is_enabled: method.catalog_is_enabled,
        sort_order: method.catalog_sort_order,
        created_at: method.created_at,
        updated_at: method.updated_at,
      }),
      createdAt: method.created_at,
      updatedAt: method.updated_at,
    };
  }

  private mapStorefront(method: StorePaymentMethodRecord): StorefrontPaymentMethodResponse {
    return {
      id: method.id,
      code: method.catalog_code,
      name: method.catalog_name_ar || method.catalog_name_en,
      nameAr: method.catalog_name_ar,
      nameEn: method.catalog_name_en,
      description: method.catalog_description_ar || method.catalog_description_en,
      descriptionAr: method.catalog_description_ar,
      descriptionEn: method.catalog_description_en,
      iconUrl: method.catalog_icon_url,
      type: method.catalog_type,
      requiresReference: method.requires_reference,
      requiresReceipt: method.requires_receipt,
      isReceiptOptional: method.is_receipt_optional,
      accountName: method.account_name,
      accountNumber: method.account_number,
      phoneNumber: method.phone_number,
      iban: method.iban,
      instructions: method.instructions_ar || method.instructions_en,
      instructionsAr: method.instructions_ar,
      instructionsEn: method.instructions_en,
      sortOrder: method.sort_order,
    };
  }
}
