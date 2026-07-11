import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number;
}
