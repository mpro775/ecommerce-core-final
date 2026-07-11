import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsNumber,
  IsDateString,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ADVANCED_OFFER_TYPES } from '../constants/advanced-offer.constants';

export class BxgyConfigDto {
  @ApiProperty({ description: 'Quantity to buy' })
  @IsNumber()
  buyQuantity!: number;

  @ApiProperty({ description: 'Product IDs to buy', type: [String] })
  @IsString({ each: true })
  buyProductIds!: string[];

  @ApiProperty({ description: 'Quantity to get free' })
  @IsNumber()
  getXQuantity!: number;

  @ApiProperty({ description: 'Product IDs to get free', type: [String] })
  @IsString({ each: true })
  getXProductIds!: string[];

  @ApiProperty({ description: 'Discount percentage on get items' })
  @IsNumber()
  discountPercent!: number;
}

export class BundleConfigDto {
  @ApiProperty({ description: 'Product IDs in bundle', type: [String] })
  @IsString({ each: true })
  productIds!: string[];

  @ApiProperty({ description: 'Discount percentage' })
  @IsNumber()
  discountPercent!: number;

  @ApiPropertyOptional({ description: 'Fixed bundle price' })
  @IsOptional()
  @IsNumber()
  fixedPrice?: number;
}

export class TierDto {
  @ApiProperty({ description: 'Minimum quantity for this tier' })
  @IsNumber()
  minQuantity!: number;

  @ApiProperty({ description: 'Discount percentage for this tier' })
  @IsNumber()
  discountPercent!: number;
}

export class TieredDiscountConfigDto {
  @ApiProperty({ description: 'Discount tiers', type: [TierDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers!: TierDto[];
}

export class AdvancedOfferConfigDto {
  @ApiPropertyOptional({ type: BxgyConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BxgyConfigDto)
  bxgy?: BxgyConfigDto;

  @ApiPropertyOptional({ type: BundleConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BundleConfigDto)
  bundle?: BundleConfigDto;

  @ApiPropertyOptional({ type: TieredDiscountConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TieredDiscountConfigDto)
  tieredDiscount?: TieredDiscountConfigDto;
}

export class CreateAdvancedOfferDto {
  @ApiProperty({ description: 'Offer name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Offer description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Offer type', enum: ADVANCED_OFFER_TYPES })
  @IsEnum(ADVANCED_OFFER_TYPES)
  offerType!: string;

  @ApiProperty({ description: 'Offer configuration' })
  @IsObject()
  @ValidateNested()
  @Type(() => AdvancedOfferConfigDto)
  config!: AdvancedOfferConfigDto;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Priority (higher = first)' })
  @IsOptional()
  @IsNumber()
  priority?: number;
}
