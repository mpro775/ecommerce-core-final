export const REVIEW_MODERATION_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;

export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const QUESTION_MODERATION_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;

export type QuestionModerationStatus = (typeof QUESTION_MODERATION_STATUSES)[number];
