import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OrderCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
