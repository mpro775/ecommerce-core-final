import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListPromotionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
