import { IsEmail, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAffiliateDto {
  @IsString()
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  payoutMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
