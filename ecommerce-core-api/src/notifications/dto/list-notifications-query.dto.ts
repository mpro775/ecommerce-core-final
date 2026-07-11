import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  MERCHANT_NOTIFICATION_CATEGORIES,
  MERCHANT_NOTIFICATION_SEVERITIES,
  type MerchantNotificationCategory,
  type MerchantNotificationSeverity,
} from '../notification-events.registry';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: MERCHANT_NOTIFICATION_CATEGORIES })
  @IsOptional()
  @IsIn(MERCHANT_NOTIFICATION_CATEGORIES)
  category?: MerchantNotificationCategory;

  @ApiPropertyOptional({ enum: MERCHANT_NOTIFICATION_SEVERITIES })
  @IsOptional()
  @IsIn(MERCHANT_NOTIFICATION_SEVERITIES)
  severity?: MerchantNotificationSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
