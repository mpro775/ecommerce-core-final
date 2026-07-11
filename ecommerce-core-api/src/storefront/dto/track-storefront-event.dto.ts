import { IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { StorefrontAnalyticsEventName } from '../constants/storefront-event.constants';

export class TrackStorefrontEventDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^sf_[a-z0-9_]+$/)
  eventName!: StorefrontAnalyticsEventName;

  @IsOptional()
  @IsUUID()
  cartId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
