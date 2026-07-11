import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SUPPORT_ASSIGNEE_TYPES, type SupportAssigneeType } from '../constants/support.constants';

export class AssignSupportTicketDto {
  @ApiPropertyOptional({ enum: SUPPORT_ASSIGNEE_TYPES })
  @IsOptional()
  @IsIn(SUPPORT_ASSIGNEE_TYPES)
  assignedToType?: SupportAssigneeType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToStoreUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedToLabel?: string;
}
