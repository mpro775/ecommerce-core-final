import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PAYMENT_STATUSES, type PaymentStatus } from '../constants/payment.constants';

export class ListPaymentsQueryDto {
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1)
  page?: number;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;
}
