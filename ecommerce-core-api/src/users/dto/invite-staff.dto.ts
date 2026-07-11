import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { TEAM_ROLE_CODES, type TeamRole } from '../../auth/constants/store-role-presets.constants';

export class InviteStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsIn(TEAM_ROLE_CODES)
  role!: TeamRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
