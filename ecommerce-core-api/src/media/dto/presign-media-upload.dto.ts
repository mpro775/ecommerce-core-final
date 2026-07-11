import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES } from '../media.constants';

export class PresignMediaUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsString()
  @MaxLength(120)
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  fileSizeBytes!: number;
}
