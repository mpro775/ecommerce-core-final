import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Response } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ManualOrderProductSearchQueryDto } from './dto/manual-order-product-search-query.dto';
import { OrdersExportQueryDto } from './dto/orders-export-query.dto';
import { UpdateManualOrderDto } from './dto/update-manual-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'List orders' })
  async list(@CurrentUser() currentUser: AuthUser, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(currentUser, query);
  }

  @Get('export/excel')
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'Export filtered orders as Excel' })
  async exportExcel(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: OrdersExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Buffer> {
    const fileName = `orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
    response.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('content-disposition', `attachment; filename="${fileName}"`);
    return this.ordersService.exportToExcel(currentUser, query);
  }

  @Get('manual/products')
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'Search products for manual order creation' })
  async searchManualProducts(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ManualOrderProductSearchQueryDto,
  ) {
    return this.ordersService.searchManualProducts(currentUser, query);
  }

  @Post('manual')
  @RequirePermissions(PERMISSIONS.ordersWrite)
  @ApiOkResponse({ description: 'Create manual order from admin panel' })
  async createManual(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateManualOrderDto,
    @Req() request: Request,
  ) {
    return this.ordersService.createManual(currentUser, body, getRequestContext(request));
  }

  @Patch(':orderId/manual')
  @RequirePermissions(PERMISSIONS.ordersWrite)
  @ApiOkResponse({ description: 'Update manual order before shipping' })
  async updateManual(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: UpdateManualOrderDto,
    @Req() request: Request,
  ) {
    return this.ordersService.updateManual(currentUser, orderId, body, getRequestContext(request));
  }

  @Get(':orderId')
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'Get order details' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getById(currentUser, orderId);
  }

  @Patch(':orderId/status')
  @RequirePermissions(PERMISSIONS.ordersWrite)
  @ApiOkResponse({ description: 'Update order status' })
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: UpdateOrderStatusDto,
    @Req() request: Request,
  ) {
    return this.ordersService.updateStatus(currentUser, orderId, body, getRequestContext(request));
  }
}
