import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_SCOPES,
  SUPPORT_TICKET_STATUSES,
  type SupportTicketPriority,
  type SupportTicketScope,
  type SupportTicketStatus,
} from '../constants/support.constants';

export class ListSupportTicketsQueryDto {
  @ApiPropertyOptional({ enum: SUPPORT_TICKET_SCOPES })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_SCOPES)
  scope?: SupportTicketScope;

  @ApiPropertyOptional({ enum: SUPPORT_TICKET_STATUSES })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_STATUSES)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ enum: SUPPORT_TICKET_PRIORITIES })
  @IsOptional()
  @IsIn(SUPPORT_TICKET_PRIORITIES)
  priority?: SupportTicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
