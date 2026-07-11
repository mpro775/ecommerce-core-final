import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ReplaceProductWarehouseLinksDto } from './dto/replace-product-warehouse-links.dto';
import { ReplaceVariantWarehouseAllocationsDto } from './dto/replace-variant-warehouse-allocations.dto';
import { UpdateWarehousePriorityOrderDto } from './dto/update-warehouse-priority-order.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import {
  WarehousesService,
  type ProductWarehouseLinkResponse,
  type VariantWarehouseAllocationResponse,
  type WarehouseResponse,
} from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List warehouses' })
  async list(@CurrentUser() currentUser: AuthUser): Promise<WarehouseResponse[]> {
    return this.warehousesService.list(currentUser);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create warehouse' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateWarehouseDto,
    @Req() request: Request,
  ): Promise<WarehouseResponse> {
    return this.warehousesService.create(currentUser, body, getRequestContext(request));
  }

  @Get('products/:productId/links')
  @RequirePermissions(PERMISSIONS.productsRead)
  @ApiOkResponse({ description: 'List product warehouse links (for products without variants)' })
  async listProductLinks(
    @CurrentUser() currentUser: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductWarehouseLinkResponse[]> {
    return this.warehousesService.listProductLinks(currentUser, productId);
  }

  @Put('products/:productId/links')
  @RequirePermissions(PERMISSIONS.productsWrite)
  @ApiOkResponse({ description: 'Replace product warehouse links (for products without variants)' })
  async replaceProductLinks(
    @CurrentUser() currentUser: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: ReplaceProductWarehouseLinksDto,
    @Req() request: Request,
  ): Promise<ProductWarehouseLinkResponse[]> {
    return this.warehousesService.replaceProductLinks(
      currentUser,
      productId,
      body,
      getRequestContext(request),
    );
  }

  @Get('variants/:variantId/allocations')
  @RequirePermissions(PERMISSIONS.inventoryRead)
  @ApiOkResponse({ description: 'List variant allocations across warehouses' })
  async listVariantAllocations(
    @CurrentUser() currentUser: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ): Promise<VariantWarehouseAllocationResponse[]> {
    return this.warehousesService.listVariantAllocations(currentUser, variantId);
  }

  @Put('variants/:variantId/allocations')
  @RequirePermissions(PERMISSIONS.inventoryWrite)
  @ApiOkResponse({ description: 'Replace variant allocations across warehouses' })
  async replaceVariantAllocations(
    @CurrentUser() currentUser: AuthUser,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: ReplaceVariantWarehouseAllocationsDto,
    @Req() request: Request,
  ): Promise<VariantWarehouseAllocationResponse[]> {
    return this.warehousesService.replaceVariantAllocations(
      currentUser,
      variantId,
      body,
      getRequestContext(request),
    );
  }

  @Post(':warehouseId/default')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Set warehouse as default' })
  async setDefault(
    @CurrentUser() currentUser: AuthUser,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Req() request: Request,
  ): Promise<WarehouseResponse> {
    return this.warehousesService.setDefault(currentUser, warehouseId, getRequestContext(request));
  }

  @Put('priority-order')
  @RequirePermissions(PERMISSIONS.inventoryWrite)
  @ApiOkResponse({ description: 'Update warehouse withdrawal priority order' })
  async updatePriorityOrder(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateWarehousePriorityOrderDto,
    @Req() request: Request,
  ): Promise<WarehouseResponse[]> {
    return this.warehousesService.updatePriorityOrder(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Put(':warehouseId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update warehouse' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() body: UpdateWarehouseDto,
    @Req() request: Request,
  ): Promise<WarehouseResponse> {
    return this.warehousesService.update(
      currentUser,
      warehouseId,
      body,
      getRequestContext(request),
    );
  }
}
