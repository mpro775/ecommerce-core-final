import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PAYMENT_METHODS, type PaymentMethod } from '../../orders/constants/payment.constants';

export class CheckoutDto {
  @IsUUID('4')
  cartId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsString()
  @MaxLength(120)
  customerName!: string;

  @IsString()
  @MaxLength(30)
  customerPhone!: string;

  @IsOptional()
  @IsUUID('4')
  customerAddressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerEmail?: string;

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
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  mapProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  placeLabel?: string;

  @IsOptional()
  @IsUUID('4')
  shippingZoneId?: string;

  @IsOptional()
  @IsUUID('4')
  shippingMethodId?: string;

  @IsOptional()
  @IsUUID('4')
  fulfillmentZoneId?: string;

  @IsOptional()
  @IsUUID('4')
  fulfillmentMethodId?: string;

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
  @IsUUID('4')
  storePaymentMethodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  payerReference?: string;

  @IsOptional()
  @IsUUID('4')
  payerReceiptMediaAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  payerNote?: string;

  @IsOptional()
  @IsString()
  customerAccessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  restockToken?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  pointsToRedeem?: number;
}
