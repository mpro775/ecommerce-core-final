import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMediaAltTextDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  altTextAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  altTextEn?: string;

  @IsOptional()
  @IsBoolean()
  isDecorative?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  captionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  captionEn?: string;
}
