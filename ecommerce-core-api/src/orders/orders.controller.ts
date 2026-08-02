import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse,
  ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Response } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { requireIdempotencyKey } from '../commercial/idempotency-key';
import { CommercialErrorResponseDto } from '../commercial/commercial-response.dto';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { ManualOrderProductSearchQueryDto } from './dto/manual-order-product-search-query.dto';
import { OrdersExportQueryDto } from './dto/orders-export-query.dto';
import { UpdateManualOrderDto } from './dto/update-manual-order.dto';
import { OrderCommandDto } from './dto/order-command.dto';
import { OrderDetailDto, PaginatedOrdersDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';
import { FulfillmentTransitionService } from './transitions/fulfillment-transition.service';
import type { FulfillmentCommand } from './transitions/fulfillment-transition.rules';

@ApiTags('orders')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: CommercialErrorResponseDto })
@ApiForbiddenResponse({ type: CommercialErrorResponseDto })
@ApiConflictResponse({ type: CommercialErrorResponseDto })
@Controller('orders')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService,
    private readonly fulfillmentTransitions: FulfillmentTransitionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'List orders', type: PaginatedOrdersDto })
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
  @RequirePermissions(PERMISSIONS.ordersCreateManual)
  @ApiOkResponse({ description: 'Create manual order from admin panel' })
  async createManual(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateManualOrderDto,
    @Req() request: Request,
  ) {
    return this.ordersService.createManual(currentUser, body, requireIdempotencyKey(request), getRequestContext(request));
  }

  @Post(':orderId/manual/edit')
  @RequirePermissions(PERMISSIONS.ordersEditManual)
  @ApiOkResponse({ description: 'Update manual order before shipping' })
  async updateManual(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: UpdateManualOrderDto,
    @Req() request: Request,
  ) {
    return this.ordersService.updateManual(currentUser, orderId, body,
      requireIdempotencyKey(request),getRequestContext(request));
  }

  @Get(':orderId')
  @RequirePermissions(PERMISSIONS.ordersRead)
  @ApiOkResponse({ description: 'Get order details', type: OrderDetailDto })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.getById(currentUser, orderId);
  }

  @Post(':orderId/confirm')
  @RequirePermissions(PERMISSIONS.ordersConfirm)
  async confirm(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: OrderCommandDto,
    @Req() request: Request,
  ) {
    return this.ordersService.confirmOrder(currentUser, orderId, body, requireIdempotencyKey(request), getRequestContext(request));
  }

  @Post(':orderId/cancel')
  @RequirePermissions(PERMISSIONS.ordersCancel)
  async cancel(@CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string, @Body() body: OrderCommandDto,
    @Req() request: Request) {
    return this.ordersService.cancelOrder(currentUser, orderId, body, requireIdempotencyKey(request), getRequestContext(request));
  }

  @Post(':orderId/complete')
  @RequirePermissions(PERMISSIONS.ordersComplete)
  async complete(@CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string, @Body() body: OrderCommandDto,
    @Req() request: Request) {
    return this.ordersService.completeOrder(currentUser, orderId, body, requireIdempotencyKey(request), getRequestContext(request));
  }

  @Post(':orderId/fulfillment/start-preparing')
  @RequirePermissions(PERMISSIONS.fulfillmentStartPreparing)
  startPreparing(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('startPreparing', user, id, body, request);
  }

  @Post(':orderId/fulfillment/start-preparing-with-payment-override')
  @RequirePermissions(PERMISSIONS.ordersOverridePaymentGate)
  overrideStartPreparing(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('overrideStartPreparing', user, id, body, request);
  }

  @Post(':orderId/fulfillment/mark-ready')
  @RequirePermissions(PERMISSIONS.fulfillmentMarkReady)
  markReady(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('markReady', user, id, body, request);
  }

  @Post(':orderId/fulfillment/dispatch')
  @RequirePermissions(PERMISSIONS.fulfillmentDispatch)
  dispatch(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('dispatch', user, id, body, request);
  }

  @Post(':orderId/fulfillment/mark-fulfilled')
  @RequirePermissions(PERMISSIONS.fulfillmentFulfill)
  markFulfilled(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('markFulfilled', user, id, body, request);
  }

  @Post(':orderId/fulfillment/mark-failed')
  @RequirePermissions(PERMISSIONS.fulfillmentFail)
  markFailed(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('markFailed', user, id, body, request);
  }

  @Post(':orderId/fulfillment/retry')
  @RequirePermissions(PERMISSIONS.fulfillmentRetry)
  retry(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('retryDispatch', user, id, body, request);
  }

  @Post(':orderId/fulfillment/cancel')
  @RequirePermissions(PERMISSIONS.fulfillmentCancel)
  cancelFulfillment(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) id: string,
    @Body() body: OrderCommandDto, @Req() request: Request) {
    return this.fulfillmentCommand('cancelFulfillment', user, id, body, request);
  }

  private fulfillmentCommand(command: FulfillmentCommand, user: AuthUser, orderId: string,
    body: OrderCommandDto, request: Request) {
    return this.fulfillmentTransitions.execute({ command, orderId, storeId: user.storeId,
      idempotencyKey: requireIdempotencyKey(request), reason: body.reason,
      expectedVersion: body.expectedVersion,
      actor: { id: user.id, type: 'admin', permissions: user.permissions },
      context: getRequestContext(request) });
  }
}
