import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class PaymentCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsUUID('4')
  mediaAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  payerReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  payerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  collectionReference?: string;
}
