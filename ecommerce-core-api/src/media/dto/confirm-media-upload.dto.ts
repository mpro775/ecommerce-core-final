import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES } from '../media.constants';

export class ConfirmMediaUploadDto {
  @IsString()
  @MaxLength(1024)
  objectKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  fileSizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  etag?: string;
}
