import type { Request } from 'express';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  storeId?: string;
}
