import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { SkipSetupStepDto } from './dto/skip-setup-step.dto';
import { StoreReadinessService } from './store-readiness.service';
import type { StoreReadinessResponse } from './store-readiness.types';

@ApiTags('store-readiness')
@ApiBearerAuth()
@Controller('merchant/store-readiness')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class StoreReadinessController {
  constructor(private readonly storeReadinessService: StoreReadinessService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get store readiness and setup progress' })
  getReadiness(@CurrentUser() user: AuthUser): Promise<StoreReadinessResponse> {
    return this.storeReadinessService.getReadiness(user);
  }

  @Post('steps/:stepKey/skip')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Skip optional setup step' })
  skipStep(
    @CurrentUser() user: AuthUser,
    @Param('stepKey') stepKey: string,
    @Body() body: SkipSetupStepDto,
  ): Promise<StoreReadinessResponse> {
    return this.storeReadinessService.skipStep(user, stepKey, body.reason);
  }

  @Delete('steps/:stepKey/skip')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Cancel optional setup step skip' })
  unskipStep(
    @CurrentUser() user: AuthUser,
    @Param('stepKey') stepKey: string,
  ): Promise<StoreReadinessResponse> {
    return this.storeReadinessService.unskipStep(user, stepKey);
  }

  @Post('quick-actions/:action')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Run setup quick action' })
  runQuickAction(
    @CurrentUser() user: AuthUser,
    @Param('action') action: string,
    @Req() request: Request,
  ): Promise<StoreReadinessResponse> {
    return this.storeReadinessService.runQuickAction(user, action, getRequestContext(request));
  }
}
