import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      return true;
    }

    const headerStoreId = request.header('x-store-id') ?? null;
    const paramStoreId = this.extractStoreIdParam(request.params);

    this.assertTenantMatch(user.storeId, headerStoreId);
    this.assertTenantMatch(user.storeId, paramStoreId);

    await this.assertStoreNotSuspended(user.storeId, request.path);

    request.storeId = user.storeId;
    return true;
  }

  private extractStoreIdParam(params: Record<string, unknown> | undefined): string | null {
    if (!params || typeof params.storeId !== 'string') {
      return null;
    }
    return params.storeId;
  }

  private assertTenantMatch(userStoreId: string, candidate: string | null): void {
    if (!candidate || candidate === userStoreId) {
      return;
    }
    throw new ForbiddenException('Cross-tenant access is forbidden');
  }

  private async assertStoreNotSuspended(storeId: string, path: string): Promise<void> {
    const result = await this.databaseService.db.query<{ is_suspended: boolean }>(
      `
        SELECT is_suspended
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );

    if (result.rows[0]?.is_suspended && !this.isRecoveryPath(path)) {
      throw new ForbiddenException('Store is suspended');
    }
  }

  private isRecoveryPath(path: string): boolean {
    return path.startsWith('/billing') || path.startsWith('/support');
  }
}
