import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuickFulfillmentSetupDto {
  @IsString()
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsBoolean()
  enableLocalDelivery?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  localDeliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  enablePickup?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  pickupAddress?: string;

  @IsOptional()
  @IsBoolean()
  enableGovernorateShipping?: boolean;
}
