import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PAYMENT_STATUSES, type PaymentStatus } from '../constants/payment.constants';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;
}
