import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse,
  ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentCommandDto } from './dto/payment-command.dto';
import {
  PaymentsService,
  type PaymentResponse,
} from './payments.service';
import { PaymentTransitionService } from './payment-transition.service';
import type { PaymentCommand } from './payment-transition.rules';
import { PaginatedPaymentsDto, PaymentDto } from './dto/payment-response.dto';

@ApiTags('payments')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: CommercialErrorResponseDto })
@ApiForbiddenResponse({ type: CommercialErrorResponseDto })
@ApiConflictResponse({ type: CommercialErrorResponseDto })
@Controller('payments')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService,
    private readonly paymentTransitions: PaymentTransitionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'List payments for the store', type: PaginatedPaymentsDto })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.list(currentUser, query);
  }

  @Get('pending-review')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'List payments pending review', type: PaginatedPaymentsDto })
  async listPendingReview(
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.paymentsService.listPendingReview(currentUser);
  }

  @Get('order/:orderId')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'Get payment by order ID', type: PaymentDto })
  async getByOrderId(
    @CurrentUser() currentUser: AuthUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getByOrderId(currentUser, orderId);
  }

  @Get(':paymentId')
  @RequirePermissions(PERMISSIONS.paymentsRead)
  @ApiOkResponse({ description: 'Get payment by ID', type: PaymentDto })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<PaymentResponse> {
    return this.paymentsService.getById(currentUser, paymentId);
  }

  @Post(':paymentId/submit-proof')
  @RequirePermissions(PERMISSIONS.paymentsSubmitProof)
  submitProof(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('submitPaymentProof',user,id,body,request);
  }

  @Post(':paymentId/resubmit-proof')
  @RequirePermissions(PERMISSIONS.paymentsSubmitProof)
  resubmitProof(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('resubmitPaymentProof',user,id,body,request);
  }

  @Post(':paymentId/start-review')
  @RequirePermissions(PERMISSIONS.paymentsStartReview)
  startReview(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('startPaymentReview',user,id,body,request);
  }

  @Post(':paymentId/approve')
  @RequirePermissions(PERMISSIONS.paymentsApprove)
  approve(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('approvePayment',user,id,body,request);
  }

  @Post(':paymentId/reject')
  @RequirePermissions(PERMISSIONS.paymentsReject)
  reject(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('rejectPayment',user,id,body,request);
  }

  @Post(':paymentId/collect-cod')
  @RequirePermissions(PERMISSIONS.paymentsCollectCod)
  collectCod(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('collectCodPayment',user,id,body,request);
  }

  @Post(':paymentId/expire')
  @RequirePermissions(PERMISSIONS.paymentsExpire)
  expire(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('expirePayment',user,id,body,request);
  }

  @Post(':paymentId/cancel')
  @RequirePermissions(PERMISSIONS.paymentsCancel)
  cancel(@CurrentUser() user: AuthUser, @Param('paymentId', ParseUUIDPipe) id: string,
    @Body() body: PaymentCommandDto, @Req() request: Request) {
    return this.command('cancelPayment',user,id,body,request);
  }

  private command(command: PaymentCommand,user: AuthUser,paymentId: string,
    body: PaymentCommandDto,request: Request) {
    return this.paymentTransitions.execute({command,paymentId,storeId:user.storeId,
      idempotencyKey:requireIdempotencyKey(request),reason:body.reason,
      expectedVersion:body.expectedVersion,
      proof:{mediaAssetId:body.mediaAssetId,payerReference:body.payerReference,
        payerNote:body.payerNote,collectionReference:body.collectionReference},
      actor:{id:user.id,type:'admin',permissions:user.permissions},context:getRequestContext(request)});
  }
}
