import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { WEBHOOK_EVENTS } from '../constants/webhook-events.constants';

export class TriggerWebhookEventDto {
  @ApiProperty({ enum: WEBHOOK_EVENTS })
  @IsEnum(WEBHOOK_EVENTS)
  eventType!: string;

  @ApiProperty({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
