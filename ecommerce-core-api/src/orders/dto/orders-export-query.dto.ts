import { IsIn, IsOptional, IsString } from 'class-validator';
import { ORDER_STATUSES } from '../constants/order-status.constants';
import { PAYMENT_METHODS } from '../constants/payment.constants';

const PAYMENT_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'refunded'] as const;

export class OrdersExportQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
