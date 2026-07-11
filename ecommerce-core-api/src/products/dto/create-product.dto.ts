import {
  IsDateString,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRODUCT_STATUSES } from '../constants/product-status.constants';
import { PRODUCT_TYPES } from '../constants/product-type.constants';
import {
  ProductBundleItemDto,
  ProductCustomFieldDto,
  ProductDigitalFileDto,
  ProductInlineDiscountDto,
} from './product-extensions.dto';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descriptionEn?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  productType?: (typeof PRODUCT_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  stockUnlimited?: boolean;

  @IsOptional()
  @IsBoolean()
  questionsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weightUnit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsObject()
  dimensions?: { length?: number; width?: number; height?: number };

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  seoDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  seoDescriptionEn?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedProductIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  shortDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  shortDescriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  detailedDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  detailedDescriptionEn?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductInlineDiscountDto)
  inlineDiscount?: ProductInlineDiscountDto;

  @IsOptional()
  @IsBoolean()
  inlineDiscountEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductBundleItemDto)
  bundleItems?: ProductBundleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDigitalFileDto)
  digitalFiles?: ProductDigitalFileDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  digitalDownloadAttemptsLimit?: number;

  @IsOptional()
  @IsDateString()
  digitalDownloadExpiresAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCustomFieldDto)
  customFields?: ProductCustomFieldDto[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOrderQuantity?: number;
}
