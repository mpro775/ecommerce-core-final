import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { STORE_CURRENCY_CODES } from '../constants/store-settings.constants';

export class StoreCurrencyDto {
  @IsString()
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  currencyCode!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  yerPerUnit!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4)
  decimalDigits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  roundingIncrement?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateStoreCurrenciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreCurrencyDto)
  currencies!: StoreCurrencyDto[];
}
