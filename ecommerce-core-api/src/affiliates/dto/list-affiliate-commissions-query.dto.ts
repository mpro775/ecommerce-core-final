import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AFFILIATE_COMMISSION_STATUSES } from '../constants/affiliate.constants';

export class ListAffiliateCommissionsQueryDto {
  @IsOptional()
  @IsUUID('4')
  affiliateId?: string;

  @IsOptional()
  @IsIn(AFFILIATE_COMMISSION_STATUSES)
  status?: (typeof AFFILIATE_COMMISSION_STATUSES)[number];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
