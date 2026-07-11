import { IsInt, Min } from 'class-validator';

export class UpdateLowStockThresholdDto {
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}
