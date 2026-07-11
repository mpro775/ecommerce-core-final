import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ANALYTICS_WINDOWS } from '../constants/analytics.constants';

export class AnalyticsWindowQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn(ANALYTICS_WINDOWS)
  preset?: (typeof ANALYTICS_WINDOWS)[number];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn(ANALYTICS_WINDOWS)
  window?: (typeof ANALYTICS_WINDOWS)[number];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(120)
  liveMinutes?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
