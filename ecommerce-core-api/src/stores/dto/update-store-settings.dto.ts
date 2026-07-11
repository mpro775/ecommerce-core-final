import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { STORE_SLUG_REGEX } from '../constants/store-slug.constants';
import {
  CURRENCY_PRICING_MODES,
  CURRENCY_SYMBOL_POSITIONS,
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
} from '../constants/store-settings.constants';

class WorkingHoursSlotDto {
  @IsString()
  @Length(5, 5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  open!: string;

  @IsString()
  @Length(5, 5)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  close!: string;
}

class WorkingHoursDayDto {
  @IsIn(STORE_WORKING_DAYS)
  day!: (typeof STORE_WORKING_DAYS)[number];

  @IsBoolean()
  isClosed!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursSlotDto)
  slots?: WorkingHoursSlotDto[];
}

class StoreProfileSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  icon?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[A-Fa-f0-9]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[A-Fa-f0-9]{6}$/)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string | null;

  @IsOptional()
  @IsIn(STORE_LANGUAGES)
  defaultLanguage?: (typeof STORE_LANGUAGES)[number];

  @IsOptional()
  @IsArray()
  @IsIn(STORE_LANGUAGES, { each: true })
  supportedLanguages?: Array<(typeof STORE_LANGUAGES)[number]>;
}

class CurrencySettingsDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsArray()
  @IsIn(STORE_CURRENCY_CODES, { each: true })
  supportedCurrencies?: Array<(typeof STORE_CURRENCY_CODES)[number]>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  decimalDigits?: number;

  @IsOptional()
  @IsIn(CURRENCY_SYMBOL_POSITIONS)
  symbolPosition?: (typeof CURRENCY_SYMBOL_POSITIONS)[number];

  @IsOptional()
  @IsIn(CURRENCY_PRICING_MODES)
  pricingMode?: (typeof CURRENCY_PRICING_MODES)[number];

  @IsOptional()
  @IsObject()
  fixedPrices?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  exchangeRates?: Record<string, unknown>;
}

class OrderSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumOrderValue?: number;

  @IsOptional()
  @IsBoolean()
  allowGuestCheckout?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOrderCancellation?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43200)
  cancellationWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowReturns?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  returnWindowDays?: number;

  @IsOptional()
  @IsIn(ORDER_CONFIRMATION_MODES)
  confirmationMode?: (typeof ORDER_CONFIRMATION_MODES)[number];

  @IsOptional()
  @IsIn(STOCK_DEDUCTION_TIMINGS)
  stockDeductionTiming?: (typeof STOCK_DEDUCTION_TIMINGS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  orderNumberPrefix?: string;
}

class InventorySettingsDto {
  @IsOptional()
  @IsBoolean()
  allowOutOfStockSales?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  lowStockAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  reserveInventory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(43200)
  reservationTtlMinutes?: number;

  @IsOptional()
  @IsIn(WAREHOUSE_SELECTION_MODES)
  warehouseSelectionMode?: (typeof WAREHOUSE_SELECTION_MODES)[number];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  warehousePriority?: string[];

  @IsOptional()
  @IsBoolean()
  restoreStockOnCancellation?: boolean;
}

class TaxSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  defaultRate?: number;

  @IsOptional()
  @IsIn(TAX_PRICE_MODES)
  priceMode?: (typeof TAX_PRICE_MODES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exemptions?: string[];

  @IsOptional()
  @IsObject()
  categoryRates?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxNumber?: string | null;
}

class MobileAppConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  latestAndroidVersion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  latestIosVersion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  minimumAndroidVersion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  minimumIosVersion?: string | null;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  maintenanceMessage?: string | null;

  @IsOptional()
  @IsObject()
  storeLinks?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  enabledFeatures?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  showRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  showOtp?: boolean;

  @IsOptional()
  @IsBoolean()
  showWallet?: boolean;

  @IsOptional()
  @IsBoolean()
  showLoyalty?: boolean;

  @IsOptional()
  @IsBoolean()
  showAffiliates?: boolean;

  @IsOptional()
  @IsBoolean()
  showReviews?: boolean;
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(STORE_SLUG_REGEX, {
    message:
      'Slug must be 3-50 chars and contain only lowercase letters, numbers, and hyphens. It must not start or end with a hyphen.',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsIn(STORE_TIMEZONES)
  timezone?: string;

  @IsOptional()
  @IsUUID('4')
  logoMediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  logoUrl?: string | null;

  @IsOptional()
  @IsUUID('4')
  faviconMediaAssetId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  faviconUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(STORE_BUSINESS_CATEGORIES)
  businessCategory?: (typeof STORE_BUSINESS_CATEGORIES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsIn(YEMEN_GOVERNORATES, { message: 'اختر محافظة يمنية صحيحة' })
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetails?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDayDto)
  workingHours?: WorkingHoursDayDto[];

  @IsOptional()
  @IsObject()
  socialLinks?: Partial<Record<(typeof STORE_SOCIAL_LINK_KEYS)[number], string | null>>;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  shippingPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  returnPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  privacyPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  loyaltyPolicy?: string;

  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreProfileSettingsDto)
  profile?: StoreProfileSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CurrencySettingsDto)
  currencySettings?: CurrencySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderSettingsDto)
  orderSettings?: OrderSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InventorySettingsDto)
  inventorySettings?: InventorySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaxSettingsDto)
  taxSettings?: TaxSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileAppConfigDto)
  mobileAppConfig?: MobileAppConfigDto;
}
