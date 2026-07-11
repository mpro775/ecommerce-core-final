import {
  ArrayUnique,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleEn?: string;

  @IsString()
  @MaxLength(80)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  barcode?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attributeValueIds?: string[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
