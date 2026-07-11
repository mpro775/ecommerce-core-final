import { IsIn } from 'class-validator';
import {
  REVIEW_MODERATION_STATUSES,
  type ReviewModerationStatus,
} from '../constants/customer-engagement.constants';

export class ModerateReviewDto {
  @IsIn(REVIEW_MODERATION_STATUSES)
  status!: Exclude<ReviewModerationStatus, 'PENDING'>;
}
