import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { LOYALTY_ENTRY_TYPES } from '../constants/loyalty.constants';

export class ListLoyaltyLedgerQueryDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsIn(LOYALTY_ENTRY_TYPES)
  entryType?: (typeof LOYALTY_ENTRY_TYPES)[number];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
