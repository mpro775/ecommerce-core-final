import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateAffiliateLinkDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  targetPath?: string;
}
