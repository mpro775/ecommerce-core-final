import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateAccessibilityPreferencesDto {
  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;

  @IsOptional()
  @IsIn(['100', '115', '130', '150'])
  fontScale?: '100' | '115' | '130' | '150';

  @IsOptional()
  @IsBoolean()
  underlineLinks?: boolean;

  @IsOptional()
  @IsBoolean()
  strongFocusRing?: boolean;
}
