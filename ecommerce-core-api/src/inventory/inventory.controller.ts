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
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import { ListInventoryReservationsQueryDto } from './dto/list-inventory-reservations-query.dto';
import { UpdateLowStockThresholdDto } from './dto/update-low-stock-threshold.dto';
import { InventoryService, type VariantWithdrawalPriorityResponse } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  @RequirePermissions(PERMISSIONS.inventoryRead)
  @ApiOkResponse({ description: 'List inventory movements' })
  async listMovements(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListInventoryMovementsQueryDto,
  ) {
    return this.inventoryService.listMovements(currentUser, query);
  }

  @Get('reservations')
  @RequirePermissions(PERMISSIONS.inventoryRead)
  @ApiOkResponse({ description: 'List inventory reservations' })
  async listReservations(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListInventoryReservationsQueryDto,
  ) {
    return this.inventoryService.listReservations(currentUser, query);
  }

  @Get('alerts/low-stock')
  @RequirePermissions(PERMISSIONS.inventoryRead)
  @ApiOkResponse({ description: 'List low-stock inventory alerts' })
  async listLowStockAlerts(@CurrentUser() currentUser: AuthUser) {
    return this.inventoryService.listLowStockAlerts(currentUser);
  }

  @Get('variants/:variantId/withdrawal-priority')
  @RequirePermissions(PERMISSIONS.inventoryRead)
  @ApiOkResponse({ description: 'List warehouse withdrawal priority for variant' })
  async listVariantWithdrawalPriority(
    @CurrentUser() currentUser: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ): Promise<VariantWithdrawalPriorityResponse[]> {
    return this.inventoryService.listVariantWithdrawalPriority(currentUser, variantId);
  }

  @Post('variants/:variantId/adjustments')
  @RequirePermissions(PERMISSIONS.inventoryWrite)
  @ApiOkResponse({ description: 'Adjust variant stock and create movement record' })
  async adjustVariant(
    @CurrentUser() currentUser: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: AdjustInventoryDto,
    @Req() request: Request,
  ) {
    return this.inventoryService.adjustVariantStock(
      currentUser,
      variantId,
      body,
      getRequestContext(request),
    );
  }

  @Put('variants/:variantId/threshold')
  @RequirePermissions(PERMISSIONS.inventoryWrite)
  @ApiOkResponse({ description: 'Update low-stock threshold for a variant' })
  async updateLowStockThreshold(
    @CurrentUser() currentUser: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: UpdateLowStockThresholdDto,
    @Req() request: Request,
  ) {
    return this.inventoryService.updateLowStockThreshold(
      currentUser,
      variantId,
      body.lowStockThreshold,
      getRequestContext(request),
    );
  }
}
