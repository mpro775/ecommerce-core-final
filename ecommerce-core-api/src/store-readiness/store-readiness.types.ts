export type SetupStepStatus = 'completed' | 'skipped' | 'missing' | 'warning' | 'blocking';

export interface SetupStep {
  key: string;
  title: string;
  description: string;
  status: SetupStepStatus;
  required: boolean;
  skippable: boolean;
  actionLabel: string;
  actionTab: string;
  quickAction: string | null;
}

export interface SetupSection {
  key: string;
  title: string;
  weight: number;
  completedSteps: number;
  totalSteps: number;
  status: SetupStepStatus;
  steps: SetupStep[];
}

export interface StoreReadinessResponse {
  score: number;
  status: 'ready' | 'needs_attention' | 'not_ready';
  canReceiveOrders: boolean;
  completedSteps: number;
  totalSteps: number;
  blockingIssues: SetupStep[];
  warnings: SetupStep[];
  nextBestAction: SetupStep | null;
  sections: SetupSection[];
}
