import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListShippingZonesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
