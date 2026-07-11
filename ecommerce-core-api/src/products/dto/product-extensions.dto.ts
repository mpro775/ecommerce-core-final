import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DISCOUNT_TYPES } from '../../promotions/constants/discount.constants';

export class ProductBundleItemDto {
  @IsUUID('4')
  bundledProductId!: string;

  @IsOptional()
  @IsUUID('4')
  bundledVariantId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductDigitalFileDto {
  @IsUUID('4')
  mediaAssetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ProductCustomFieldDto {
  @IsString()
  @MaxLength(120)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  labelAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  labelEn?: string;

  @IsOptional()
  @IsObject()
  value?: Record<string, unknown>;
}

export class ProductInlineDiscountDto {
  @IsIn(DISCOUNT_TYPES)
  type!: (typeof DISCOUNT_TYPES)[number];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class ProductCategoryIdsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds!: string[];
}

export class ProductRelatedIdsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  relatedProductIds!: string[];
}

export class ProductBundleItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductBundleItemDto)
  bundleItems!: ProductBundleItemDto[];
}

export class ProductDigitalFilesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDigitalFileDto)
  digitalFiles!: ProductDigitalFileDto[];
}

export class ProductCustomFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductCustomFieldDto)
  customFields!: ProductCustomFieldDto[];
}
