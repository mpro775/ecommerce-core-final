import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  PAYMENT_METHOD_TYPES,
  type PaymentMethodType,
} from '../constants/payment-method.constants';

export class UpsertPlatformPaymentMethodDto {
  @IsString()
  @MaxLength(60)
  code!: string;

  @IsString()
  @MaxLength(120)
  nameAr!: string;

  @IsString()
  @MaxLength(120)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mediaAssetId?: string;

  @IsIn(PAYMENT_METHOD_TYPES)
  type!: PaymentMethodType;

  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresReceipt?: boolean;

  @IsOptional()
  @IsBoolean()
  isReceiptOptional?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class TogglePlatformPaymentMethodDto {
  @IsBoolean()
  isEnabled!: boolean;
}
