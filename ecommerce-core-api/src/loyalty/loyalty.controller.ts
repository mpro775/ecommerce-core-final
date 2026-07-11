import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
import { CreateLoyaltyAdjustmentDto } from './dto/create-loyalty-adjustment.dto';
import { ListLoyaltyLedgerQueryDto } from './dto/list-loyalty-ledger-query.dto';
import { UpdateLoyaltyRulesDto } from './dto/update-loyalty-rules.dto';
import { UpdateLoyaltySettingsDto } from './dto/update-loyalty-settings.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@ApiBearerAuth()
@Controller('loyalty')

@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.loyaltyRead)
  @ApiOkResponse({ description: 'Get loyalty settings' })
  async getSettings(@CurrentUser() currentUser: AuthUser) {
    return this.loyaltyService.getSettings(currentUser);
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.loyaltyWrite)
  @ApiOkResponse({ description: 'Update loyalty settings' })
  async updateSettings(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateLoyaltySettingsDto,
    @Req() request: Request,
  ) {
    return this.loyaltyService.updateSettings(currentUser, body, getRequestContext(request));
  }

  @Get('rules')
  @RequirePermissions(PERMISSIONS.loyaltyRead)
  @ApiOkResponse({ description: 'Get loyalty earn rules' })
  async getRules(@CurrentUser() currentUser: AuthUser) {
    return this.loyaltyService.getRules(currentUser);
  }

  @Put('rules')
  @RequirePermissions(PERMISSIONS.loyaltyWrite)
  @ApiOkResponse({ description: 'Replace loyalty earn rules' })
  async updateRules(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateLoyaltyRulesDto,
    @Req() request: Request,
  ) {
    return this.loyaltyService.updateRules(currentUser, body, getRequestContext(request));
  }

  @Get('customers/:customerId/wallet')
  @RequirePermissions(PERMISSIONS.loyaltyRead)
  @ApiOkResponse({ description: 'Get customer loyalty wallet' })
  async getCustomerWallet(
    @CurrentUser() currentUser: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.loyaltyService.getWalletForCustomer(currentUser, customerId);
  }

  @Post('customers/:customerId/adjustments')
  @RequirePermissions(PERMISSIONS.loyaltyAdjust)
  @ApiOkResponse({ description: 'Create loyalty points adjustment' })
  async createAdjustment(
    @CurrentUser() currentUser: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: CreateLoyaltyAdjustmentDto,
    @Req() request: Request,
  ) {
    return this.loyaltyService.createAdjustment(
      currentUser,
      customerId,
      body,
      getRequestContext(request),
    );
  }

  @Get('ledger')
  @RequirePermissions(PERMISSIONS.loyaltyRead)
  @ApiOkResponse({ description: 'List loyalty ledger entries' })
  async listLedger(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListLoyaltyLedgerQueryDto,
  ) {
    return this.loyaltyService.listLedgerForStore(currentUser, query);
  }
}
