import type { StoreRole } from './auth-user.interface';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  storeId: string;
  email: string;
  fullName: string;
  role: StoreRole;
  permissions: string[];
}
