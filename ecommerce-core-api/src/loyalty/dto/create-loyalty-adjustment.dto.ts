import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateLoyaltyAdjustmentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  pointsDelta!: number;

  @ValidateIf((input: CreateLoyaltyAdjustmentDto) => input.pointsDelta < 0)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  maxNegativePoints?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
