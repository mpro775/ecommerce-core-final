import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DISCOUNT_TYPES } from '../constants/discount.constants';
import { OFFER_TARGET_TYPES } from '../constants/offer.constants';

export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(OFFER_TARGET_TYPES)
  targetType?: (typeof OFFER_TARGET_TYPES)[number];

  @IsOptional()
  @IsUUID('4')
  targetProductId?: string;

  @IsOptional()
  @IsUUID('4')
  targetCategoryId?: string;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: (typeof DISCOUNT_TYPES)[number];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
