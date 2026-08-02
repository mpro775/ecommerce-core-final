import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DISCOUNT_TYPES } from '../constants/discount.constants';

export class CreateCouponDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: (typeof DISCOUNT_TYPES)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsUUID('4')
  affiliateId?: string;

  @IsOptional()
  @IsBoolean()
  isFreeShipping?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  includedProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludedProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  includedCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  excludedCategoryIds?: string[];
}
