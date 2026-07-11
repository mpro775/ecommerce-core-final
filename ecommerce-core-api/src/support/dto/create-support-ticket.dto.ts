import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_SCOPES,
  type SupportTicketPriority,
  type SupportTicketScope,
} from '../constants/support.constants';

export class CreateSupportTicketDto {
  @ApiProperty({ enum: SUPPORT_TICKET_SCOPES })
  @IsIn(SUPPORT_TICKET_SCOPES)
  scope!: SupportTicketScope;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
