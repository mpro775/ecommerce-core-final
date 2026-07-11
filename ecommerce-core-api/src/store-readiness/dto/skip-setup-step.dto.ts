import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SkipSetupStepDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
