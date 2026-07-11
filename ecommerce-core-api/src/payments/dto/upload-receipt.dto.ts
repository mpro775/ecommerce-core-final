import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UploadReceiptDto {
  @IsUUID('4')
  orderId!: string;

  @IsUUID('4')
  mediaAssetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
