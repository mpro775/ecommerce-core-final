import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAffiliatePayoutBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
