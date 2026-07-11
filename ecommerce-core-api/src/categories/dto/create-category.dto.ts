import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionEn?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @IsUUID('4')
  mediaAssetId?: string;

  @IsOptional()
  @IsUUID('4')
  backgroundMediaAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  imageAltAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  imageAltEn?: string;

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
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
