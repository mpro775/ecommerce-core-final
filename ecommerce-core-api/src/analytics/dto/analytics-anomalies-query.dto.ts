import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AnalyticsWindowQueryDto } from './analytics-window-query.dto';

export class AnalyticsAnomaliesQueryDto extends AnalyticsWindowQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(5)
  @Max(300)
  anomalyThresholdPercent?: number;
}
