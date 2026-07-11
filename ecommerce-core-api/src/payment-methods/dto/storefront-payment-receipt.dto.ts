import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StorefrontPresignReceiptDto {
  @IsString()
  @MaxLength(160)
  fileName!: string;

  @IsString()
  @MaxLength(80)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSizeBytes!: number;
}

export class StorefrontConfirmReceiptDto {
  @IsString()
  @MaxLength(1000)
  objectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  etag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fileName?: string;
}
