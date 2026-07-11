import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkAffiliatePayoutPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
