import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SUPPORT_TICKET_STATUSES, type SupportTicketStatus } from '../constants/support.constants';

export class UpdateSupportTicketStatusDto {
  @ApiProperty({ enum: SUPPORT_TICKET_STATUSES })
  @IsIn(SUPPORT_TICKET_STATUSES)
  status!: SupportTicketStatus;
}
