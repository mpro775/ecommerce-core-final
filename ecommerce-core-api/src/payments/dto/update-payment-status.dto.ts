import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PAYMENT_STATUSES, type PaymentStatus } from '../constants/payment.constants';

export class UpdatePaymentStatusDto {
  @IsIn(PAYMENT_STATUSES)
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
