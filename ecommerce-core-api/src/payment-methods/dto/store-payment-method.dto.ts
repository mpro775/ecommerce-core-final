import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateStorePaymentMethodDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructionsAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructionsEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ToggleStorePaymentMethodDto {
  @IsBoolean()
  isEnabled!: boolean;
}
