import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '../constants/payment.constants';
import { ManualOrderLineDto } from './create-manual-order.dto';

export class UpdateManualOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualOrderLineDto)
  lines?: ManualOrderLineDto[];

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsUUID('4')
  customerAddressId?: string;

  @IsOptional()
  @IsUUID('4')
  shippingZoneId?: string;

  @IsOptional()
  @IsUUID('4')
  shippingMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  priceOverrideReason?: string;
}
