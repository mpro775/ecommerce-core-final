import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateFilterValueDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  valueAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  valueEn?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[A-Fa-f0-9]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
