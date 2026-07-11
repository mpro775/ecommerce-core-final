import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackOrderQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  store?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
