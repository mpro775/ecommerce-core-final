import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { TEAM_ROLE_CODES, type TeamRole } from '../../auth/constants/store-role-presets.constants';

export class UpdateUserRoleDto {
  @IsIn(TEAM_ROLE_CODES)
  role!: TeamRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
