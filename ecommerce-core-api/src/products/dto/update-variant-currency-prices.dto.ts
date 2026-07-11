import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { STORE_CURRENCY_CODES } from '../../stores/constants/store-settings.constants';

export class VariantCurrencyPriceDto {
  @IsString()
  @Length(3, 3)
  @IsIn(STORE_CURRENCY_CODES)
  currencyCode!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number | null;
}

export class UpdateVariantCurrencyPricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantCurrencyPriceDto)
  overrides!: VariantCurrencyPriceDto[];
}
