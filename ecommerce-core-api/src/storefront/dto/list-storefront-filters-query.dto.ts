import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class ListStorefrontFiltersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  store?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  categorySlug?: string;
}
