import { IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutQuoteDto {
  @IsUUID('4')
  cartId!: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

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
  couponCode?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  pointsToRedeem?: number;

  @IsOptional()
  @IsString()
  customerAccessToken?: string;
}
