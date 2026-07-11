import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  QUESTION_MODERATION_STATUSES,
  type QuestionModerationStatus,
} from '../constants/customer-engagement.constants';

export class ModerateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  answer?: string;

  @IsIn(QUESTION_MODERATION_STATUSES)
  status!: QuestionModerationStatus;
}
