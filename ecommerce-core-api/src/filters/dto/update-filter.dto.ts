import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DISPLAY_TYPES,
  FILTER_SOURCE_TYPES,
  FILTER_TYPES,
} from '../constants/filter-type.constants';

export class UpdateFilterDto {
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
  @IsIn(FILTER_TYPES)
  type?: (typeof FILTER_TYPES)[number];

  @IsOptional()
  @IsIn(FILTER_SOURCE_TYPES)
  sourceType?: (typeof FILTER_SOURCE_TYPES)[number];

  @IsOptional()
  @IsString()
  sourceAttributeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceKey?: string | null;

  @IsOptional()
  @IsIn(DISPLAY_TYPES)
  displayType?: (typeof DISPLAY_TYPES)[number] | null;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
