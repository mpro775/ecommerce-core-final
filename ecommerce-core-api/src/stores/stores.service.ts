import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import { parseIanaTimezone } from '../common/utils/timezone.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { MediaService, type AltTextCoverageResponse } from '../media/media.service';
import { CurrencyService, type StoreCurrencyResponse } from '../currency/currency.service';
import {
  CURRENCY_PRICING_MODES,
  CURRENCY_SYMBOL_POSITIONS,
  DEFAULT_STORE_COUNTRY,
  ORDER_CONFIRMATION_MODES,
  STORE_BUSINESS_CATEGORIES,
  STORE_CURRENCY_CODES,
  STORE_LANGUAGES,
  STORE_SOCIAL_LINK_KEYS,
  STORE_TIMEZONES,
  STORE_WORKING_DAYS,
  STOCK_DEDUCTION_TIMINGS,
  TAX_PRICE_MODES,
  WAREHOUSE_SELECTION_MODES,
  YEMEN_GOVERNORATES,
} from './constants/store-settings.constants';
import {
  isReservedStoreSubdomain,
  isValidStoreSlug,
  normalizeStoreSlug,
} from './constants/store-slug.constants';
import type { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import {
  StoresRepository,
  type StoreGeneralSettingsRecord,
  type StoreSettingsRecord,
} from './stores.repository';

interface WorkingHoursSlot {
  open: string;
  close: string;
}

interface WorkingHoursDay {
  day: (typeof STORE_WORKING_DAYS)[number];
  isClosed: boolean;
  slots: WorkingHoursSlot[];
}

type SocialLinks = Partial<Record<(typeof STORE_SOCIAL_LINK_KEYS)[number], string | null>>;

type JsonObject = Record<string, unknown>;

export interface StoreProfileSettingsResponse {
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  logo: string | null;
  icon: string | null;
  primaryColor: string;
  secondaryColor: string;
  supportPhone: string | null;
  supportEmail: string | null;
  whatsapp: string | null;
  country: string;
  timezone: string;
  defaultLanguage: (typeof STORE_LANGUAGES)[number];
  supportedLanguages: Array<(typeof STORE_LANGUAGES)[number]>;
}

export interface StoreCurrencySettingsResponse {
  baseCurrencyCode: 'YER';
  defaultCurrencyCode: string;
  supportedCurrencies: string[];
  decimalDigits: number;
  decimalDigitsByCurrency: Record<string, number>;
  symbolPosition: (typeof CURRENCY_SYMBOL_POSITIONS)[number];
  pricingMode: (typeof CURRENCY_PRICING_MODES)[number];
  fixedPrices: JsonObject;
  exchangeRates: Record<string, number>;
}

export interface StoreOrderSettingsResponse {
  minimumOrderValue: number;
  allowGuestCheckout: boolean;
  allowOrderCancellation: boolean;
  cancellationWindowMinutes: number;
  allowReturns: boolean;
  returnWindowDays: number;
  confirmationMode: (typeof ORDER_CONFIRMATION_MODES)[number];
  stockDeductionTiming: (typeof STOCK_DEDUCTION_TIMINGS)[number];
  orderNumberPrefix: string;
}

export interface StoreInventorySettingsResponse {
  allowOutOfStockSales: boolean;
  lowStockAlertThreshold: number;
  reserveInventory: boolean;
  reservationTtlMinutes: number;
  warehouseSelectionMode: (typeof WAREHOUSE_SELECTION_MODES)[number];
  warehousePriority: string[];
  restoreStockOnCancellation: boolean;
}

export interface StoreTaxSettingsResponse {
  enabled: boolean;
  defaultRate: number;
  priceMode: (typeof TAX_PRICE_MODES)[number];
  exemptions: string[];
  categoryRates: JsonObject;
  taxNumber: string | null;
}

export interface StoreMobileAppConfigResponse {
  latestAndroidVersion: string | null;
  latestIosVersion: string | null;
  minimumAndroidVersion: string | null;
  minimumIosVersion: string | null;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  storeLinks: JsonObject;
  socialLinks: JsonObject;
  enabledFeatures: JsonObject;
  showRegistration: boolean;
  showOtp: boolean;
  showWallet: boolean;
  showLoyalty: boolean;
  showAffiliates: boolean;
  showReviews: boolean;
}

export interface StoreSettingsResponse {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  description: string | null;
  slug: string;
  logoMediaAssetId: string | null;
  logoUrl: string | null;
  faviconMediaAssetId: string | null;
  faviconUrl: string | null;
  businessCategory: string | null;
  onboardingCompleted: boolean;
  phone: string | null;
  address: string | null;
  country: string;
  city: string | null;
  addressDetails: string | null;
  latitude: number | null;
  longitude: number | null;
  workingHours: WorkingHoursDay[];
  socialLinks: SocialLinks;
  currencyCode: string;
  baseCurrencyCode: string;
  defaultCurrencyCode: string;
  currencies: StoreCurrencyResponse[];
  timezone: string;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  loyaltyPolicy: string | null;
  profile: StoreProfileSettingsResponse;
  currencySettings: StoreCurrencySettingsResponse;
  orderSettings: StoreOrderSettingsResponse;
  inventorySettings: StoreInventorySettingsResponse;
  taxSettings: StoreTaxSettingsResponse;
  mobileAppConfig: StoreMobileAppConfigResponse;
}

export interface StoreSettingsOptionsResponse {
  defaultCountry: string;
  currencies: readonly string[];
  timezones: readonly string[];
  governorates: readonly string[];
  workingDays: readonly string[];
  socialPlatforms: readonly string[];
  businessCategories: readonly string[];
  languages: readonly string[];
}

export interface StoreSlugAvailabilityResponse {
  isValidFormat: boolean;
  isAvailable: boolean;
  normalizedSlug: string;
  reason?: 'reserved' | 'invalid_format' | 'taken';
}

export interface StoreAccessibilityReportResponse {
  storeId: string;
  themeAuditSummary: {
    score: number;
    wcagLevel: 'AA';
    criticalIssues: number;
    seriousIssues: number;
    warningIssues: number;
    auditedAt: string;
  };
  altTextCoverage: AltTextCoverageResponse;
  criticalIssues: Array<Record<string, never>>;
  seriousIssues: Array<Record<string, never>>;
  recommendations: string[];
}

@Injectable()
export class StoresService {
  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly auditService: AuditService,
    private readonly mediaService: MediaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async getSettings(currentUser: AuthUser): Promise<StoreSettingsResponse> {
    return this.getSettingsByStoreId(currentUser.storeId);
  }

  async getSettingsByStoreId(storeId: string): Promise<StoreSettingsResponse> {
    const store = await this.storesRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    const [currencies, generalSettings] = await Promise.all([
      this.currencyService.listStoreCurrencies(storeId),
      this.storesRepository.findGeneralSettings(storeId),
    ]);
    return this.toResponse(store, currencies, generalSettings);
  }

  getSettingsOptions(): StoreSettingsOptionsResponse {
    return {
      defaultCountry: DEFAULT_STORE_COUNTRY,
      currencies: STORE_CURRENCY_CODES,
      timezones: STORE_TIMEZONES,
      governorates: YEMEN_GOVERNORATES,
      workingDays: STORE_WORKING_DAYS,
      socialPlatforms: STORE_SOCIAL_LINK_KEYS,
      businessCategories: STORE_BUSINESS_CATEGORIES,
      languages: STORE_LANGUAGES,
    };
  }

  async checkSlugAvailability(
    currentUser: AuthUser,
    rawSlug: string,
  ): Promise<StoreSlugAvailabilityResponse> {
    const normalizedSlug = normalizeStoreSlug(rawSlug);
    if (isReservedStoreSubdomain(normalizedSlug)) {
      return {
        isValidFormat: true,
        isAvailable: false,
        normalizedSlug,
        reason: 'reserved',
      };
    }

    const isValidFormat = isValidStoreSlug(normalizedSlug);
    if (!isValidFormat) {
      return {
        isValidFormat: false,
        isAvailable: false,
        normalizedSlug,
        reason: 'invalid_format',
      };
    }

    const existingStore = await this.storesRepository.findStoreBySlug(normalizedSlug);
    const isAvailable = !existingStore || existingStore.id === currentUser.storeId;

    return {
      isValidFormat: true,
      isAvailable,
      normalizedSlug,
      ...(isAvailable ? {} : { reason: 'taken' as const }),
    };
  }

  async updateSettings(
    currentUser: AuthUser,
    input: UpdateStoreSettingsDto,
    context: RequestContextData,
  ): Promise<StoreSettingsResponse> {
    const current = await this.storesRepository.findById(currentUser.storeId);
    if (!current) {
      throw new NotFoundException('Store not found');
    }

    const payload = await this.buildUpdatePayload(current, input);
    const updated = await this.storesRepository.updateSettings(payload);
    const [currencies, currentGeneralSettings] = await Promise.all([
      this.currencyService.listStoreCurrencies(currentUser.storeId),
      this.storesRepository.findGeneralSettings(currentUser.storeId),
    ]);
    const updatedGeneralSettings = await this.storesRepository.updateGeneralSettings(
      this.buildGeneralSettingsPayload(updated, currentGeneralSettings, currencies, input),
    );
    await this.logSettingsUpdate(currentUser, context);

    return this.toResponse(updated, currencies, updatedGeneralSettings);
  }

  async getCurrencies(currentUser: AuthUser): Promise<{
    baseCurrencyCode: 'YER';
    defaultCurrencyCode: string;
    currencies: StoreCurrencyResponse[];
  }> {
    const currencies = await this.currencyService.listStoreCurrencies(currentUser.storeId);
    const defaultCurrency = currencies.find((currency) => currency.isDefault) ?? currencies[0];
    return {
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? 'YER',
      currencies,
    };
  }

  async updateCurrencies(
    currentUser: AuthUser,
    currencies: StoreCurrencyResponse[],
    context: RequestContextData,
  ): Promise<{
    baseCurrencyCode: 'YER';
    defaultCurrencyCode: string;
    currencies: StoreCurrencyResponse[];
  }> {
    const updated = await this.currencyService.replaceStoreCurrencies(
      currentUser.storeId,
      currencies,
    );
    await this.auditService.log({
      action: 'store.currencies_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
    const defaultCurrency = updated.find((currency) => currency.isDefault) ?? updated[0];
    return {
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? 'YER',
      currencies: updated,
    };
  }

  async getAltTextCoverage(
    currentUser: AuthUser,
    storeId: string,
  ): Promise<AltTextCoverageResponse> {
    this.assertCurrentStore(currentUser, storeId);
    return this.mediaService.getAltTextCoverageByStoreId(storeId);
  }

  async getAccessibilityReport(
    currentUser: AuthUser,
    storeId: string,
    context: RequestContextData,
  ): Promise<StoreAccessibilityReportResponse> {
    this.assertCurrentStore(currentUser, storeId);
    const altTextCoverage = await this.mediaService.getAltTextCoverageByStoreId(storeId);
    const criticalIssues: Array<Record<string, never>> = [];
    const seriousIssues: Array<Record<string, never>> = [];
    const recommendations = [
      ...(altTextCoverage.missingAltImages > 0
        ? ['Add localized alt text or mark decorative images explicitly.']
        : []),
    ];

    await this.auditService.log({
      action: 'store.accessibility_report_generated',
      storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        score: altTextCoverage.completionRate,
        criticalIssues: 0,
        seriousIssues: 0,
        missingAltImages: altTextCoverage.missingAltImages,
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    });

    return {
      storeId,
      themeAuditSummary: {
        score: altTextCoverage.completionRate,
        wcagLevel: 'AA',
        criticalIssues: 0,
        seriousIssues: 0,
        warningIssues: 0,
        auditedAt: new Date().toISOString(),
      },
      altTextCoverage,
      criticalIssues,
      seriousIssues,
      recommendations,
    };
  }

  private assertCurrentStore(currentUser: AuthUser, storeId: string): void {
    if (currentUser.storeId !== storeId) {
      throw new ForbiddenException(
        'You can only access accessibility reports for your current store.',
      );
    }
  }

  private async buildUpdatePayload(current: StoreSettingsRecord, input: UpdateStoreSettingsDto) {
    const hasTimezone = this.hasOwn(input, 'timezone');
    const hasCurrencyCode = this.hasOwn(input, 'currencyCode');
    const hasSlug = this.hasOwn(input, 'slug');
    const hasCountry = this.hasOwn(input, 'country');
    const hasCity = this.hasOwn(input, 'city');
    const hasAddressDetails = this.hasOwn(input, 'addressDetails');
    const hasAddress = this.hasOwn(input, 'address');
    const hasLogoMediaAssetId = this.hasOwn(input, 'logoMediaAssetId');
    const hasLogoUrl = this.hasOwn(input, 'logoUrl');
    const hasFaviconMediaAssetId = this.hasOwn(input, 'faviconMediaAssetId');
    const hasFaviconUrl = this.hasOwn(input, 'faviconUrl');
    const hasBusinessCategory = this.hasOwn(input, 'businessCategory');
    const hasOnboardingCompleted = this.hasOwn(input, 'onboardingCompleted');
    const hasPhone = this.hasOwn(input, 'phone');
    const hasShippingPolicy = this.hasOwn(input, 'shippingPolicy');
    const hasReturnPolicy = this.hasOwn(input, 'returnPolicy');
    const hasPrivacyPolicy = this.hasOwn(input, 'privacyPolicy');
    const hasTerms = this.hasOwn(input, 'termsAndConditions');
    const hasLoyaltyPolicy = this.hasOwn(input, 'loyaltyPolicy');
    const hasLatitude = this.hasOwn(input, 'latitude');
    const hasLongitude = this.hasOwn(input, 'longitude');
    const hasNameAr = this.hasOwn(input, 'nameAr');
    const hasNameEn = this.hasOwn(input, 'nameEn');
    const hasDescriptionAr = this.hasOwn(input, 'descriptionAr');
    const hasDescriptionEn = this.hasOwn(input, 'descriptionEn');
    const hasDescription = this.hasOwn(input, 'description');

    const resolvedTimezone =
      hasTimezone && typeof input.timezone === 'string'
        ? parseIanaTimezone(input.timezone)
        : current.timezone;

    if (!resolvedTimezone) {
      throw new BadRequestException('Invalid timezone. Please use a valid IANA timezone value.');
    }

    const country = hasCountry
      ? this.normalizeCountry(input.country)
      : (current.country ?? DEFAULT_STORE_COUNTRY);
    const city = hasCity ? this.normalizeOptionalText(input.city, 80) : current.city;
    const addressDetails = hasAddressDetails
      ? this.normalizeOptionalText(input.addressDetails, 500)
      : current.address_details;

    const latitude = hasLatitude ? (input.latitude ?? null) : current.latitude;
    const longitude = hasLongitude ? (input.longitude ?? null) : current.longitude;
    if ((latitude === null) !== (longitude === null)) {
      throw new BadRequestException('Latitude and longitude must be provided together.');
    }

    const workingHours = this.resolveWorkingHours(current.working_hours, input.workingHours);
    const socialLinks = this.resolveSocialLinks(current.social_links, input.socialLinks);
    const resolvedAddress = hasAddress
      ? this.normalizeOptionalText(input.address, 250)
      : (this.composeAddress(country, city, addressDetails) ?? current.address);

    let resolvedSlug = current.slug;
    if (hasSlug) {
      const candidateSlug = this.normalizeOptionalText(input.slug, 50);
      const normalizedCandidateSlug = candidateSlug ? normalizeStoreSlug(candidateSlug) : null;
      if (normalizedCandidateSlug && !isValidStoreSlug(normalizedCandidateSlug)) {
        throw new BadRequestException('Store slug format is invalid.');
      }

      if (normalizedCandidateSlug) {
        const existingStore = await this.storesRepository.findStoreBySlug(normalizedCandidateSlug);
        if (existingStore && existingStore.id !== current.id) {
          throw new BadRequestException('Store slug already in use.');
        }
        resolvedSlug = normalizedCandidateSlug;
      }
    }

    const resolvedName = this.hasOwn(input, 'name')
      ? (this.normalizeOptionalText(input.name, 120) ?? current.name)
      : current.name;

    const resolvedNameAr = hasNameAr
      ? this.normalizeOptionalText(input.nameAr, 120)
      : current.name_ar;
    const resolvedNameEn = hasNameEn
      ? this.normalizeOptionalText(input.nameEn, 120)
      : current.name_en;

    const resolvedDescriptionAr = hasDescriptionAr
      ? this.normalizeOptionalText(input.descriptionAr, 1000)
      : hasDescription
        ? (this.normalizeOptionalText(input.description, 1000) ?? current.description_ar)
        : current.description_ar;
    const resolvedDescriptionEn = hasDescriptionEn
      ? this.normalizeOptionalText(input.descriptionEn, 1000)
      : current.description_en;

    return {
      storeId: current.id,
      name: resolvedName,
      nameAr: resolvedNameAr ?? resolvedName,
      nameEn: resolvedNameEn,
      descriptionAr: resolvedDescriptionAr,
      descriptionEn: resolvedDescriptionEn,
      slug: resolvedSlug,
      currencyCode:
        hasCurrencyCode && typeof input.currencyCode === 'string'
          ? input.currencyCode
          : current.currency_code,
      timezone: resolvedTimezone,
      logoMediaAssetId: hasLogoMediaAssetId
        ? (input.logoMediaAssetId ?? null)
        : current.logo_media_asset_id,
      logoUrl: hasLogoUrl ? this.normalizeOptionalText(input.logoUrl, 400) : current.logo_url,
      faviconMediaAssetId: hasFaviconMediaAssetId
        ? (input.faviconMediaAssetId ?? null)
        : current.favicon_media_asset_id,
      faviconUrl: hasFaviconUrl
        ? this.normalizeOptionalText(input.faviconUrl, 400)
        : current.favicon_url,
      businessCategory: hasBusinessCategory
        ? (input.businessCategory ?? null)
        : current.business_category,
      phone: hasPhone ? this.normalizeOptionalText(input.phone, 30) : current.phone,
      address: resolvedAddress,
      country,
      city,
      addressDetails,
      latitude,
      longitude,
      workingHours,
      socialLinks,
      shippingPolicy: hasShippingPolicy
        ? this.normalizeOptionalText(input.shippingPolicy, 20000)
        : current.shipping_policy,
      returnPolicy: hasReturnPolicy
        ? this.normalizeOptionalText(input.returnPolicy, 20000)
        : current.return_policy,
      privacyPolicy: hasPrivacyPolicy
        ? this.normalizeOptionalText(input.privacyPolicy, 20000)
        : current.privacy_policy,
      termsOfService: hasTerms
        ? this.normalizeOptionalText(input.termsAndConditions, 20000)
        : current.terms_of_service,
      loyaltyPolicy: hasLoyaltyPolicy
        ? this.normalizeOptionalText(input.loyaltyPolicy, 20000)
        : current.loyalty_policy,
      onboardingCompletedAt: hasOnboardingCompleted
        ? input.onboardingCompleted
          ? new Date()
          : null
        : current.onboarding_completed_at,
    };
  }

  private async logSettingsUpdate(
    currentUser: AuthUser,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action: 'store.settings_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'store',
      targetId: currentUser.storeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(
    store: StoreSettingsRecord,
    currencies: StoreCurrencyResponse[] = [],
    generalSettings: StoreGeneralSettingsRecord | null = null,
  ): StoreSettingsResponse {
    const defaultCurrency = currencies.find((currency) => currency.isDefault);
    const profile = this.toProfileSettingsResponse(store, generalSettings?.profile_settings);
    const currencySettings = this.toCurrencySettingsResponse(
      store,
      currencies,
      generalSettings?.currency_settings,
    );
    const orderSettings = this.toOrderSettingsResponse(generalSettings?.order_settings);
    const inventorySettings = this.toInventorySettingsResponse(
      generalSettings?.inventory_settings,
    );
    const taxSettings = this.toTaxSettingsResponse(generalSettings?.tax_settings);
    const mobileAppConfig = this.toMobileAppConfigResponse(generalSettings?.mobile_app_config);
    return {
      id: store.id,
      name: store.name,
      nameAr: store.name_ar ?? store.name,
      nameEn: store.name_en,
      descriptionAr: store.description_ar,
      descriptionEn: store.description_en,
      description: store.description_ar ?? store.description_en ?? null,
      slug: store.slug,
      logoMediaAssetId: store.logo_media_asset_id,
      logoUrl: store.logo_url,
      faviconMediaAssetId: store.favicon_media_asset_id,
      faviconUrl: store.favicon_url,
      businessCategory: store.business_category,
      onboardingCompleted: Boolean(store.onboarding_completed_at),
      phone: store.phone,
      address: store.address,
      country: this.normalizeCountry(store.country),
      city: store.city,
      addressDetails: store.address_details,
      latitude: store.latitude,
      longitude: store.longitude,
      workingHours: this.resolveWorkingHours(store.working_hours, undefined),
      socialLinks: this.resolveSocialLinks(store.social_links, undefined),
      currencyCode:
        defaultCurrency?.currencyCode ?? store.default_currency_code ?? store.currency_code,
      baseCurrencyCode: 'YER',
      defaultCurrencyCode: defaultCurrency?.currencyCode ?? store.default_currency_code ?? 'YER',
      currencies,
      timezone: store.timezone,
      shippingPolicy: store.shipping_policy,
      returnPolicy: store.return_policy,
      privacyPolicy: store.privacy_policy,
      termsAndConditions: store.terms_of_service,
      loyaltyPolicy: store.loyalty_policy,
      profile,
      currencySettings,
      orderSettings,
      inventorySettings,
      taxSettings,
      mobileAppConfig,
    };
  }

  private buildGeneralSettingsPayload(
    store: StoreSettingsRecord,
    current: StoreGeneralSettingsRecord | null,
    currencies: StoreCurrencyResponse[],
    input: UpdateStoreSettingsDto,
  ): {
    storeId: string;
    profileSettings: JsonObject;
    currencySettings: JsonObject;
    orderSettings: JsonObject;
    inventorySettings: JsonObject;
    taxSettings: JsonObject;
    mobileAppConfig: JsonObject;
  } {
    const profileSettings = this.mergeSettings(
      this.defaultProfileSettings(store),
      current?.profile_settings,
      {
        ...this.pickDefined(input.profile),
        ...(input.profile?.icon !== undefined ? { iconUrl: input.profile.icon } : {}),
        ...(this.hasOwn(input, 'phone') ? { supportPhone: store.phone } : {}),
        ...(this.hasOwn(input, 'faviconUrl') ? { iconUrl: store.favicon_url } : {}),
      },
    );
    const currencySettings = this.mergeSettings(
      this.defaultCurrencySettings(currencies, store.default_currency_code ?? store.currency_code),
      current?.currency_settings,
      {
        ...this.pickDefined(input.currencySettings),
        ...(this.hasOwn(input, 'currencyCode') ? { defaultCurrencyCode: store.currency_code } : {}),
      },
    );
    const orderSettings = this.mergeSettings(
      this.defaultOrderSettings(),
      current?.order_settings,
      this.pickDefined(input.orderSettings),
    );
    const inventorySettings = this.mergeSettings(
      this.defaultInventorySettings(),
      current?.inventory_settings,
      this.pickDefined(input.inventorySettings),
    );
    const taxSettings = this.mergeSettings(
      this.defaultTaxSettings(),
      current?.tax_settings,
      this.pickDefined(input.taxSettings),
    );
    const mobileAppConfig = this.mergeSettings(
      this.defaultMobileAppConfig(profileSettings),
      current?.mobile_app_config,
      this.pickDefined(input.mobileAppConfig),
    );

    return {
      storeId: store.id,
      profileSettings: this.normalizeProfileSettings(profileSettings),
      currencySettings: this.normalizeCurrencySettings(currencySettings, currencies, store),
      orderSettings: this.normalizeOrderSettings(orderSettings),
      inventorySettings: this.normalizeInventorySettings(inventorySettings),
      taxSettings: this.normalizeTaxSettings(taxSettings),
      mobileAppConfig: this.normalizeMobileAppConfig(mobileAppConfig),
    };
  }

  private toProfileSettingsResponse(
    store: StoreSettingsRecord,
    settings: JsonObject | undefined,
  ): StoreProfileSettingsResponse {
    const normalized = this.normalizeProfileSettings(
      this.mergeSettings(this.defaultProfileSettings(store), settings),
    );
    return {
      nameAr: store.name_ar ?? store.name,
      nameEn: store.name_en,
      descriptionAr: store.description_ar,
      descriptionEn: store.description_en,
      logo: store.logo_url,
      icon: this.readString(normalized, 'iconUrl', store.favicon_url ?? store.logo_url),
      primaryColor: this.readColor(normalized, 'primaryColor', '#111827'),
      secondaryColor: this.readColor(normalized, 'secondaryColor', '#F59E0B'),
      supportPhone: this.readString(normalized, 'supportPhone', store.phone),
      supportEmail: this.readString(normalized, 'supportEmail', null),
      whatsapp: this.readString(
        normalized,
        'whatsapp',
        typeof store.social_links?.whatsapp === 'string' ? store.social_links.whatsapp : null,
      ),
      country: this.normalizeCountry(store.country),
      timezone: store.timezone,
      defaultLanguage: this.readEnum(normalized, 'defaultLanguage', STORE_LANGUAGES, 'ar'),
      supportedLanguages: this.readEnumArray(
        normalized,
        'supportedLanguages',
        STORE_LANGUAGES,
        [...STORE_LANGUAGES],
      ),
    };
  }

  private toCurrencySettingsResponse(
    store: StoreSettingsRecord,
    currencies: StoreCurrencyResponse[],
    settings: JsonObject | undefined,
  ): StoreCurrencySettingsResponse {
    const normalized = this.normalizeCurrencySettings(
      this.mergeSettings(
        this.defaultCurrencySettings(currencies, store.default_currency_code ?? store.currency_code),
        settings,
      ),
      currencies,
      store,
    );
    const supportedCurrencies = currencies.map((currency) => currency.currencyCode);
    const defaultCurrency =
      currencies.find((currency) => currency.isDefault) ??
      currencies.find((currency) => currency.currencyCode === store.default_currency_code) ??
      currencies[0];
    const decimalDigitsByCurrency = Object.fromEntries(
      currencies.map((currency) => [currency.currencyCode, currency.decimalDigits]),
    );
    const exchangeRates = Object.fromEntries(
      currencies.map((currency) => [currency.currencyCode, currency.yerPerUnit]),
    );

    return {
      baseCurrencyCode: 'YER',
      defaultCurrencyCode:
        defaultCurrency?.currencyCode ??
        this.readString(normalized, 'defaultCurrencyCode', store.default_currency_code) ??
        'YER',
      supportedCurrencies:
        supportedCurrencies.length > 0
          ? supportedCurrencies
          : this.readStringArray(normalized, 'supportedCurrencies', ['YER']),
      decimalDigits: defaultCurrency?.decimalDigits ?? this.readNumber(normalized, 'decimalDigits', 0),
      decimalDigitsByCurrency,
      symbolPosition: this.readEnum(
        normalized,
        'symbolPosition',
        CURRENCY_SYMBOL_POSITIONS,
        'after',
      ),
      pricingMode: this.readEnum(normalized, 'pricingMode', CURRENCY_PRICING_MODES, 'exchange_rate'),
      fixedPrices: this.readObject(normalized, 'fixedPrices', {}),
      exchangeRates: {
        ...this.readNumberRecord(normalized, 'exchangeRates'),
        ...exchangeRates,
      },
    };
  }

  private toOrderSettingsResponse(settings: JsonObject | undefined): StoreOrderSettingsResponse {
    const normalized = this.normalizeOrderSettings(
      this.mergeSettings(this.defaultOrderSettings(), settings),
    );
    return {
      minimumOrderValue: this.readNumber(normalized, 'minimumOrderValue', 0),
      allowGuestCheckout: this.readBoolean(normalized, 'allowGuestCheckout', true),
      allowOrderCancellation: this.readBoolean(normalized, 'allowOrderCancellation', true),
      cancellationWindowMinutes: this.readNumber(normalized, 'cancellationWindowMinutes', 60),
      allowReturns: this.readBoolean(normalized, 'allowReturns', true),
      returnWindowDays: this.readNumber(normalized, 'returnWindowDays', 7),
      confirmationMode: this.readEnum(
        normalized,
        'confirmationMode',
        ORDER_CONFIRMATION_MODES,
        'manual',
      ),
      stockDeductionTiming: this.readEnum(
        normalized,
        'stockDeductionTiming',
        STOCK_DEDUCTION_TIMINGS,
        'confirmation',
      ),
      orderNumberPrefix: this.readString(normalized, 'orderNumberPrefix', 'ORD') ?? 'ORD',
    };
  }

  private toInventorySettingsResponse(
    settings: JsonObject | undefined,
  ): StoreInventorySettingsResponse {
    const normalized = this.normalizeInventorySettings(
      this.mergeSettings(this.defaultInventorySettings(), settings),
    );
    return {
      allowOutOfStockSales: this.readBoolean(normalized, 'allowOutOfStockSales', false),
      lowStockAlertThreshold: this.readNumber(normalized, 'lowStockAlertThreshold', 5),
      reserveInventory: this.readBoolean(normalized, 'reserveInventory', true),
      reservationTtlMinutes: this.readNumber(normalized, 'reservationTtlMinutes', 15),
      warehouseSelectionMode: this.readEnum(
        normalized,
        'warehouseSelectionMode',
        WAREHOUSE_SELECTION_MODES,
        'priority',
      ),
      warehousePriority: this.readStringArray(normalized, 'warehousePriority', []),
      restoreStockOnCancellation: this.readBoolean(normalized, 'restoreStockOnCancellation', true),
    };
  }

  private toTaxSettingsResponse(settings: JsonObject | undefined): StoreTaxSettingsResponse {
    const normalized = this.normalizeTaxSettings(
      this.mergeSettings(this.defaultTaxSettings(), settings),
    );
    return {
      enabled: this.readBoolean(normalized, 'enabled', false),
      defaultRate: this.readNumber(normalized, 'defaultRate', 0),
      priceMode: this.readEnum(normalized, 'priceMode', TAX_PRICE_MODES, 'exclusive'),
      exemptions: this.readStringArray(normalized, 'exemptions', []),
      categoryRates: this.readObject(normalized, 'categoryRates', {}),
      taxNumber: this.readString(normalized, 'taxNumber', null),
    };
  }

  private toMobileAppConfigResponse(settings: JsonObject | undefined): StoreMobileAppConfigResponse {
    const normalized = this.normalizeMobileAppConfig(
      this.mergeSettings(this.defaultMobileAppConfig({}), settings),
    );
    return {
      latestAndroidVersion: this.readString(normalized, 'latestAndroidVersion', null),
      latestIosVersion: this.readString(normalized, 'latestIosVersion', null),
      minimumAndroidVersion: this.readString(normalized, 'minimumAndroidVersion', null),
      minimumIosVersion: this.readString(normalized, 'minimumIosVersion', null),
      forceUpdate: this.readBoolean(normalized, 'forceUpdate', false),
      maintenanceMode: this.readBoolean(normalized, 'maintenanceMode', false),
      maintenanceMessage: this.readString(normalized, 'maintenanceMessage', null),
      storeLinks: this.readObject(normalized, 'storeLinks', {}),
      socialLinks: this.readObject(normalized, 'socialLinks', {}),
      enabledFeatures: this.readObject(normalized, 'enabledFeatures', {}),
      showRegistration: this.readBoolean(normalized, 'showRegistration', true),
      showOtp: this.readBoolean(normalized, 'showOtp', true),
      showWallet: this.readBoolean(normalized, 'showWallet', false),
      showLoyalty: this.readBoolean(normalized, 'showLoyalty', true),
      showAffiliates: this.readBoolean(normalized, 'showAffiliates', false),
      showReviews: this.readBoolean(normalized, 'showReviews', true),
    };
  }

  private defaultProfileSettings(store: StoreSettingsRecord): JsonObject {
    return {
      iconUrl: store.favicon_url ?? store.logo_url,
      primaryColor: '#111827',
      secondaryColor: '#F59E0B',
      supportPhone: store.phone,
      supportEmail: null,
      whatsapp: typeof store.social_links?.whatsapp === 'string' ? store.social_links.whatsapp : null,
      defaultLanguage: 'ar',
      supportedLanguages: ['ar', 'en'],
    };
  }

  private defaultCurrencySettings(
    currencies: StoreCurrencyResponse[],
    defaultCurrencyCode: string | null,
  ): JsonObject {
    return {
      defaultCurrencyCode: defaultCurrencyCode ?? 'YER',
      supportedCurrencies:
        currencies.length > 0 ? currencies.map((currency) => currency.currencyCode) : ['YER'],
      decimalDigits:
        currencies.find((currency) => currency.currencyCode === defaultCurrencyCode)?.decimalDigits ??
        0,
      symbolPosition: 'after',
      pricingMode: 'exchange_rate',
      fixedPrices: {},
      exchangeRates: Object.fromEntries(
        currencies.map((currency) => [currency.currencyCode, currency.yerPerUnit]),
      ),
    };
  }

  private defaultOrderSettings(): JsonObject {
    return {
      minimumOrderValue: 0,
      allowGuestCheckout: true,
      allowOrderCancellation: true,
      cancellationWindowMinutes: 60,
      allowReturns: true,
      returnWindowDays: 7,
      confirmationMode: 'manual',
      stockDeductionTiming: 'confirmation',
      orderNumberPrefix: 'ORD',
    };
  }

  private defaultInventorySettings(): JsonObject {
    return {
      allowOutOfStockSales: false,
      lowStockAlertThreshold: 5,
      reserveInventory: true,
      reservationTtlMinutes: 15,
      warehouseSelectionMode: 'priority',
      warehousePriority: [],
      restoreStockOnCancellation: true,
    };
  }

  private defaultTaxSettings(): JsonObject {
    return {
      enabled: false,
      defaultRate: 0,
      priceMode: 'exclusive',
      exemptions: [],
      categoryRates: {},
      taxNumber: null,
    };
  }

  private defaultMobileAppConfig(profileSettings: JsonObject): JsonObject {
    return {
      latestAndroidVersion: null,
      latestIosVersion: null,
      minimumAndroidVersion: null,
      minimumIosVersion: null,
      forceUpdate: false,
      maintenanceMode: false,
      maintenanceMessage: null,
      storeLinks: {},
      socialLinks: {
        whatsapp: this.readString(profileSettings, 'whatsapp', null),
      },
      enabledFeatures: {
        registration: true,
        otp: true,
        wallet: false,
        loyalty: true,
        affiliates: false,
        reviews: true,
      },
      showRegistration: true,
      showOtp: true,
      showWallet: false,
      showLoyalty: true,
      showAffiliates: false,
      showReviews: true,
    };
  }

  private mergeSettings(
    defaults: JsonObject,
    current?: JsonObject | null,
    updates?: JsonObject | null,
  ): JsonObject {
    return {
      ...defaults,
      ...this.toPlainObject(current),
      ...this.toPlainObject(updates),
    };
  }

  private pickDefined(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as JsonObject).filter(([, entryValue]) => entryValue !== undefined),
    );
  }

  private normalizeProfileSettings(settings: JsonObject): JsonObject {
    const defaultLanguage = this.readEnum(settings, 'defaultLanguage', STORE_LANGUAGES, 'ar');
    const supportedLanguages = this.readEnumArray(
      settings,
      'supportedLanguages',
      STORE_LANGUAGES,
      [...STORE_LANGUAGES],
    );
    return {
      iconUrl: this.readString(settings, 'iconUrl', null),
      primaryColor: this.readColor(settings, 'primaryColor', '#111827'),
      secondaryColor: this.readColor(settings, 'secondaryColor', '#F59E0B'),
      supportPhone: this.readString(settings, 'supportPhone', null),
      supportEmail: this.readString(settings, 'supportEmail', null),
      whatsapp: this.readString(settings, 'whatsapp', null),
      defaultLanguage,
      supportedLanguages: supportedLanguages.includes(defaultLanguage)
        ? supportedLanguages
        : [defaultLanguage, ...supportedLanguages],
    };
  }

  private normalizeCurrencySettings(
    settings: JsonObject,
    currencies: StoreCurrencyResponse[],
    store: StoreSettingsRecord,
  ): JsonObject {
    const supportedCurrencies =
      currencies.length > 0
        ? currencies.map((currency) => currency.currencyCode)
        : this.readStringArray(settings, 'supportedCurrencies', ['YER']);
    const defaultCurrencyCode =
      currencies.find((currency) => currency.isDefault)?.currencyCode ??
      this.readString(settings, 'defaultCurrencyCode', store.default_currency_code) ??
      'YER';

    return {
      defaultCurrencyCode,
      supportedCurrencies: supportedCurrencies.includes(defaultCurrencyCode)
        ? supportedCurrencies
        : [defaultCurrencyCode, ...supportedCurrencies],
      decimalDigits: this.readNumber(settings, 'decimalDigits', 0),
      symbolPosition: this.readEnum(settings, 'symbolPosition', CURRENCY_SYMBOL_POSITIONS, 'after'),
      pricingMode: this.readEnum(settings, 'pricingMode', CURRENCY_PRICING_MODES, 'exchange_rate'),
      fixedPrices: this.readObject(settings, 'fixedPrices', {}),
      exchangeRates: {
        ...this.readNumberRecord(settings, 'exchangeRates'),
        ...Object.fromEntries(currencies.map((currency) => [currency.currencyCode, currency.yerPerUnit])),
      },
    };
  }

  private normalizeOrderSettings(settings: JsonObject): JsonObject {
    return {
      minimumOrderValue: Math.max(0, this.readNumber(settings, 'minimumOrderValue', 0)),
      allowGuestCheckout: this.readBoolean(settings, 'allowGuestCheckout', true),
      allowOrderCancellation: this.readBoolean(settings, 'allowOrderCancellation', true),
      cancellationWindowMinutes: Math.max(
        0,
        Math.trunc(this.readNumber(settings, 'cancellationWindowMinutes', 60)),
      ),
      allowReturns: this.readBoolean(settings, 'allowReturns', true),
      returnWindowDays: Math.max(0, Math.trunc(this.readNumber(settings, 'returnWindowDays', 7))),
      confirmationMode: this.readEnum(
        settings,
        'confirmationMode',
        ORDER_CONFIRMATION_MODES,
        'manual',
      ),
      stockDeductionTiming: this.readEnum(
        settings,
        'stockDeductionTiming',
        STOCK_DEDUCTION_TIMINGS,
        'confirmation',
      ),
      orderNumberPrefix: this.readString(settings, 'orderNumberPrefix', 'ORD') ?? 'ORD',
    };
  }

  private normalizeInventorySettings(settings: JsonObject): JsonObject {
    return {
      allowOutOfStockSales: this.readBoolean(settings, 'allowOutOfStockSales', false),
      lowStockAlertThreshold: Math.max(
        0,
        Math.trunc(this.readNumber(settings, 'lowStockAlertThreshold', 5)),
      ),
      reserveInventory: this.readBoolean(settings, 'reserveInventory', true),
      reservationTtlMinutes: Math.max(
        1,
        Math.trunc(this.readNumber(settings, 'reservationTtlMinutes', 15)),
      ),
      warehouseSelectionMode: this.readEnum(
        settings,
        'warehouseSelectionMode',
        WAREHOUSE_SELECTION_MODES,
        'priority',
      ),
      warehousePriority: this.readStringArray(settings, 'warehousePriority', []),
      restoreStockOnCancellation: this.readBoolean(settings, 'restoreStockOnCancellation', true),
    };
  }

  private normalizeTaxSettings(settings: JsonObject): JsonObject {
    return {
      enabled: this.readBoolean(settings, 'enabled', false),
      defaultRate: Math.max(0, Math.min(100, this.readNumber(settings, 'defaultRate', 0))),
      priceMode: this.readEnum(settings, 'priceMode', TAX_PRICE_MODES, 'exclusive'),
      exemptions: this.readStringArray(settings, 'exemptions', []),
      categoryRates: this.readObject(settings, 'categoryRates', {}),
      taxNumber: this.readString(settings, 'taxNumber', null),
    };
  }

  private normalizeMobileAppConfig(settings: JsonObject): JsonObject {
    return {
      latestAndroidVersion: this.readString(settings, 'latestAndroidVersion', null),
      latestIosVersion: this.readString(settings, 'latestIosVersion', null),
      minimumAndroidVersion: this.readString(settings, 'minimumAndroidVersion', null),
      minimumIosVersion: this.readString(settings, 'minimumIosVersion', null),
      forceUpdate: this.readBoolean(settings, 'forceUpdate', false),
      maintenanceMode: this.readBoolean(settings, 'maintenanceMode', false),
      maintenanceMessage: this.readString(settings, 'maintenanceMessage', null),
      storeLinks: this.readObject(settings, 'storeLinks', {}),
      socialLinks: this.readObject(settings, 'socialLinks', {}),
      enabledFeatures: this.readObject(settings, 'enabledFeatures', {}),
      showRegistration: this.readBoolean(settings, 'showRegistration', true),
      showOtp: this.readBoolean(settings, 'showOtp', true),
      showWallet: this.readBoolean(settings, 'showWallet', false),
      showLoyalty: this.readBoolean(settings, 'showLoyalty', true),
      showAffiliates: this.readBoolean(settings, 'showAffiliates', false),
      showReviews: this.readBoolean(settings, 'showReviews', true),
    };
  }

  private toPlainObject(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as JsonObject;
  }

  private readString(settings: JsonObject, key: string, fallback: string | null): string | null {
    const value = settings[key];
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private readColor(settings: JsonObject, key: string, fallback: string): string {
    const value = this.readString(settings, key, fallback) ?? fallback;
    return /^#[A-Fa-f0-9]{6}$/.test(value) ? value : fallback;
  }

  private readNumber(settings: JsonObject, key: string, fallback: number): number {
    const value = settings[key];
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private readBoolean(settings: JsonObject, key: string, fallback: boolean): boolean {
    return typeof settings[key] === 'boolean' ? settings[key] : fallback;
  }

  private readObject(settings: JsonObject, key: string, fallback: JsonObject): JsonObject {
    const value = settings[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return fallback;
    }
    return value as JsonObject;
  }

  private readStringArray(settings: JsonObject, key: string, fallback: string[]): string[] {
    const value = settings[key];
    if (!Array.isArray(value)) {
      return fallback;
    }
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  private readNumberRecord(settings: JsonObject, key: string): Record<string, number> {
    const value = this.readObject(settings, key, {});
    return Object.fromEntries(
      Object.entries(value)
        .map(([entryKey, entryValue]) => [entryKey, Number(entryValue)] as const)
        .filter(([, entryValue]) => Number.isFinite(entryValue)),
    );
  }

  private readEnum<T extends readonly string[]>(
    settings: JsonObject,
    key: string,
    allowed: T,
    fallback: T[number],
  ): T[number] {
    const value = settings[key];
    return typeof value === 'string' && allowed.includes(value) ? value : fallback;
  }

  private readEnumArray<T extends readonly string[]>(
    settings: JsonObject,
    key: string,
    allowed: T,
    fallback: T[number][],
  ): T[number][] {
    const value = settings[key];
    if (!Array.isArray(value)) {
      return fallback;
    }

    const filtered = value.filter(
      (item): item is T[number] => typeof item === 'string' && allowed.includes(item),
    );
    return filtered.length > 0 ? [...new Set(filtered)] : fallback;
  }

  private hasOwn(input: UpdateStoreSettingsDto, key: keyof UpdateStoreSettingsDto): boolean {
    return Object.prototype.hasOwnProperty.call(input, key);
  }

  private normalizeOptionalText(
    value: string | null | undefined,
    maxLength: number,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().slice(0, maxLength);
    return normalized.length > 0 ? normalized : null;
  }

  private composeAddress(
    country: string | null,
    city: string | null,
    details: string | null,
  ): string | null {
    const parts = [country, city, details].map((part) => part?.trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    return parts.join('، ');
  }

  private normalizeCountry(value: string | null | undefined): string {
    const normalized = this.normalizeOptionalText(value, 80);
    if (!normalized) {
      return DEFAULT_STORE_COUNTRY;
    }

    const lower = normalized.toLowerCase();
    if (this.isDamagedText(normalized)) {
      return DEFAULT_STORE_COUNTRY;
    }

    if (lower === 'ye' || lower === 'yemen' || normalized === DEFAULT_STORE_COUNTRY) {
      return DEFAULT_STORE_COUNTRY;
    }

    throw new BadRequestException('الدولة يجب أن تكون اليمن');
  }

  private isDamagedText(value: string): boolean {
    return /[\uFFFDØÙ]/.test(value);
  }

  private resolveWorkingHours(
    current:
      | Array<{ day: string; isClosed: boolean; slots?: Array<{ open: string; close: string }> }>
      | null
      | undefined,
    incoming:
      | Array<{ day: string; isClosed: boolean; slots?: Array<{ open: string; close: string }> }>
      | undefined,
  ): WorkingHoursDay[] {
    const source = incoming ?? (Array.isArray(current) ? current : []);
    const normalized: WorkingHoursDay[] = [];
    const seenDays = new Set<string>();

    for (const row of source) {
      const day = typeof row.day === 'string' ? row.day : '';
      if (!STORE_WORKING_DAYS.includes(day as (typeof STORE_WORKING_DAYS)[number])) {
        continue;
      }
      if (seenDays.has(day)) {
        throw new BadRequestException('Working hours contains duplicated day values.');
      }
      seenDays.add(day);

      const isClosed = Boolean(row.isClosed);
      const rawSlots = Array.isArray(row.slots) ? row.slots : [];
      const slots: WorkingHoursSlot[] = [];

      for (const slot of rawSlots) {
        const open = typeof slot.open === 'string' ? slot.open.trim() : '';
        const close = typeof slot.close === 'string' ? slot.close.trim() : '';
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close)) {
          continue;
        }
        if (open >= close) {
          throw new BadRequestException('Working hour slot open time must be before close time.');
        }
        slots.push({ open, close });
      }

      normalized.push({
        day: day as (typeof STORE_WORKING_DAYS)[number],
        isClosed,
        slots,
      });
    }

    return normalized;
  }

  private resolveSocialLinks(
    current: Record<string, unknown> | null | undefined,
    incoming: Record<string, unknown> | undefined,
  ): SocialLinks {
    const base: SocialLinks = {};

    for (const key of STORE_SOCIAL_LINK_KEYS) {
      const fallback = key === 'x' ? (current?.['x'] ?? current?.['twitter']) : current?.[key];
      const nextValue =
        incoming && Object.prototype.hasOwnProperty.call(incoming, key) ? incoming[key] : fallback;
      if (typeof nextValue !== 'string') {
        if (nextValue === null || nextValue === undefined) {
          base[key] = null;
        }
        continue;
      }

      const normalized = nextValue.trim();
      if (normalized.length === 0) {
        base[key] = null;
        continue;
      }

      this.assertValidSocialLink(key, normalized);
      base[key] = normalized;
    }

    return base;
  }

  private assertValidSocialLink(key: string, value: string): void {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(`Invalid social link URL for "${key}".`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`Invalid social link URL for "${key}".`);
    }
  }
}
