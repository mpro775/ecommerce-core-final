import type { StoreRole } from '../constants/store-role-presets.constants';

export type { StoreRole } from '../constants/store-role-presets.constants';

export interface AuthUser {
  id: string;
  storeId: string;
  email: string;
  fullName: string;
  role: StoreRole;
  permissions: string[];
  sessionId: string;
  onboardingCompleted: boolean;
}
