import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
import {
  ORDER_CONFIRMATION_MODES,
  STORE_CURRENCY_CODES,
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
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsIn(STORE_TIMEZONES)
  timezone?: string;

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
