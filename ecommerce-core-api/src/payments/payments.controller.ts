import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import type { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import type { UploadReceiptDto } from './dto/upload-receipt.dto';
import {
  PaymentsService,
  type PaymentResponse,
  type PaymentWithOrderResponse,
} from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'List payments for the store' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaymentWithOrderResponse[]> {
    return this.paymentsService.list(currentUser, query);
  }

  @Get('pending-review')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'List payments pending review' })
  async listPendingReview(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<PaymentWithOrderResponse[]> {
    return this.paymentsService.listPendingReview(currentUser);
  }

  @Get('order/:orderId')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'Get payment by order ID' })
  async getByOrderId(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getByOrderId(currentUser, orderId);
  }

  @Get(':paymentId')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'Get payment by ID' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getById(currentUser, paymentId);
  }

  @Post('upload-receipt')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  @ApiOkResponse({ description: 'Upload transfer receipt for an order' })
  async uploadReceipt(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UploadReceiptDto,
    @Req() request: Request,
  ): Promise<PaymentResponse> {
    return this.paymentsService.uploadReceipt(currentUser, body, getRequestContext(request));
  }

  @Patch(':paymentId/status')
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  @ApiOkResponse({ description: 'Update payment status (approve/reject transfer)' })
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() body: UpdatePaymentStatusDto,
    @Req() request: Request,
  ): Promise<PaymentResponse> {
    return this.paymentsService.updateStatus(
      currentUser,
      paymentId,
      body,
      getRequestContext(request),
    );
  }

  @Patch(':paymentId/mark-collected')
  @RequirePermissions(PERMISSIONS.paymentsWrite)
  @ApiOkResponse({ description: 'Mark COD payment as collected' })
  async markCollected(
    @CurrentUser() currentUser: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() request: Request,
  ): Promise<PaymentResponse> {
    return this.paymentsService.markCollected(currentUser, paymentId, getRequestContext(request));
  }
}
