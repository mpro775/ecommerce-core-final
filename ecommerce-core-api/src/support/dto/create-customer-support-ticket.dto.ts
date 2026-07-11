import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  SUPPORT_TICKET_PRIORITIES,
  type SupportTicketPriority,
} from '../constants/support.constants';

export class CreateCustomerSupportTicketDto {
  @ApiProperty({ enum: SUPPORT_TICKET_PRIORITIES })
  @IsIn(SUPPORT_TICKET_PRIORITIES)
  priority!: SupportTicketPriority;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  message!: string;
}
