import type { AuthUser } from './auth-user.interface';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
