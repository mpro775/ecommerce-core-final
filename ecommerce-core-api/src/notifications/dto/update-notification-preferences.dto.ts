import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationPreferenceItemDto {
  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty({ enum: ['inbox', 'email'] })
  @IsIn(['inbox', 'email'])
  channel!: 'inbox' | 'email';

  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;

  @ApiProperty({ enum: ['instant', 'daily_digest', 'mute'] })
  @IsIn(['instant', 'daily_digest', 'mute'])
  frequency!: 'instant' | 'daily_digest' | 'mute';

  @ApiProperty({ enum: ['store', 'store_user'] })
  @IsIn(['store', 'store_user'])
  target!: 'store' | 'store_user';
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
