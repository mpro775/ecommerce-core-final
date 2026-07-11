import { IsBoolean, IsOptional } from 'class-validator';

export class BootstrapStorePagesDto {
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
