import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { MediaRepository } from '../media/media.repository';
import { OutboxService } from '../messaging/outbox.service';
import type { OrderStatus } from '../orders/constants/order-status.constants';
import { canTransitionPaymentStatus, type PaymentStatus } from './constants/payment.constants';
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import type { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import type { UploadReceiptDto } from './dto/upload-receipt.dto';
import {
  PaymentsRepository,
  type PaymentRecord,
  type PaymentWithOrder,
} from './payments.repository';
import { AffiliatesService } from '../affiliates/affiliates.service';

export interface PaymentResponse {
  id: string;
  storeId: string;
  orderId: string;
  method: string;
  status: PaymentStatus;
  amount: number;
  storePaymentMethodId: string | null;
  platformPaymentMethodId: string | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  payerReference: string | null;
  payerReceiptUrl: string | null;
  payerReceiptMediaAssetId: string | null;
  payerNote: string | null;
  customerSubmittedAt: Date | null;
  receiptUrl: string | null;
  receiptMediaAssetId: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  customerUploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentWithOrderResponse extends PaymentResponse {
  orderCode: string;
  orderStatus: string;
  orderTotal: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly affiliatesService: AffiliatesService,
  ) {}

  async list(
    currentUser: AuthUser,
    query: ListPaymentsQueryDto,
  ): Promise<PaymentWithOrderResponse[]> {
    const filters: { orderId?: string; status?: PaymentStatus } = {};
    if (query.orderId) {
      filters.orderId = query.orderId;
    }
    if (query.status) {
      filters.status = query.status;
    }
    const payments = await this.paymentsRepository.listByStore(currentUser.storeId, filters);
    return payments.map((p) => this.toWithOrderResponse(p));
  }

  async listPendingReview(currentUser: AuthUser): Promise<PaymentWithOrderResponse[]> {
    const payments = await this.paymentsRepository.listPendingReview(currentUser.storeId);
    return payments.map((p) => this.toWithOrderResponse(p));
  }

  async getByOrderId(currentUser: AuthUser, orderId: string): Promise<PaymentResponse> {
    const payment = await this.paymentsRepository.findByOrderId(currentUser.storeId, orderId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toResponse(payment);
  }

  async getById(currentUser: AuthUser, paymentId: string): Promise<PaymentResponse> {
    const payment = await this.paymentsRepository.findById(currentUser.storeId, paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toResponse(payment);
  }

  async uploadReceipt(
    currentUser: AuthUser,
    input: UploadReceiptDto,
    context: RequestContextData,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsRepository.findByOrderId(currentUser.storeId, input.orderId);
    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    if ((payment.payment_method_code ?? payment.method) === 'cod') {
      throw new BadRequestException('Receipt can only be uploaded for manual transfer payments');
    }

    if (payment.status !== 'pending' && payment.status !== 'rejected') {
      throw new BadRequestException('Cannot upload receipt for this payment status');
    }

    const mediaAsset = await this.mediaRepository.findById(currentUser.storeId, input.mediaAssetId);
    if (!mediaAsset) {
      throw new NotFoundException('Media asset not found');
    }

    const updated = await this.paymentsRepository.updateReceipt({
      paymentId: payment.id,
      storeId: currentUser.storeId,
      receiptMediaAssetId: input.mediaAssetId,
      receiptUrl: mediaAsset.public_url,
    });

    if (!updated) {
      throw new BadRequestException('Failed to update payment receipt');
    }

    await this.auditService.log({
      action: 'payments.receipt_uploaded',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'payment',
      targetId: payment.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        orderId: input.orderId,
        mediaAssetId: input.mediaAssetId,
        requestId: context.requestId,
      },
    });

    const paymentWithOrder = await this.paymentsRepository.findWithOrderById(
      currentUser.storeId,
      payment.id,
    );

    await this.outboxService.enqueue({
      aggregateType: 'payment',
      aggregateId: payment.id,
      eventType: 'payment.receipt_uploaded',
      payload: {
        paymentId: payment.id,
        orderId: input.orderId,
        orderCode: paymentWithOrder?.order_code,
        storeId: currentUser.storeId,
        amount: Number(updated.amount),
        currencyCode: paymentWithOrder?.order_currency_code,
        customerId: paymentWithOrder?.customer_id,
        method: updated.payment_method_code ?? updated.method,
        referenceNumber: updated.payer_reference,
        receiptUrl: updated.receipt_url ?? updated.payer_receipt_url,
        customerName: paymentWithOrder?.customer_name,
        customerPhone: paymentWithOrder?.customer_phone,
        uploadedAt: updated.customer_uploaded_at?.toISOString(),
        status: 'under_review',
        source: 'payment_receipt_upload',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });

    return this.toResponse(updated);
  }

  async updateStatus(
    currentUser: AuthUser,
    paymentId: string,
    input: UpdatePaymentStatusDto,
    context: RequestContextData,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsRepository.findById(currentUser.storeId, paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!canTransitionPaymentStatus(payment.status, input.status)) {
      throw new BadRequestException(
        `Cannot transition payment status from ${payment.status} to ${input.status}`,
      );
    }

    const updated = await this.paymentsRepository.updateStatus({
      paymentId: payment.id,
      storeId: currentUser.storeId,
      status: input.status,
      reviewedBy: currentUser.id,
      reviewNote: input.reviewNote ?? null,
    });

    if (!updated) {
      throw new BadRequestException('Failed to update payment status');
    }

    await this.auditService.log({
      action: 'payments.status_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'payment',
      targetId: payment.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        from: payment.status,
        to: input.status,
        reviewNote: input.reviewNote ?? null,
        requestId: context.requestId,
      },
    });

    const paymentWithOrder = await this.paymentsRepository.findWithOrderById(
      currentUser.storeId,
      payment.id,
    );

    await this.outboxService.enqueue({
      aggregateType: 'payment',
      aggregateId: payment.id,
      eventType: 'payment.status_changed',
      payload: {
        paymentId: payment.id,
        orderId: payment.order_id,
        orderCode: paymentWithOrder?.order_code,
        storeId: currentUser.storeId,
        amount: Number(updated.amount),
        currencyCode: paymentWithOrder?.order_currency_code,
        customerId: paymentWithOrder?.customer_id,
        method: updated.payment_method_code ?? updated.method,
        referenceNumber: updated.payer_reference,
        customerName: paymentWithOrder?.customer_name,
        customerPhone: paymentWithOrder?.customer_phone,
        from: payment.status,
        to: input.status,
        source: 'payment_status_update',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });

    await this.affiliatesService.handlePaymentStatusChanged({
      storeId: currentUser.storeId,
      orderId: payment.order_id,
      nextStatus: input.status,
    });

    return this.toResponse(updated);
  }

  async markCollected(
    currentUser: AuthUser,
    paymentId: string,
    context: RequestContextData,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsRepository.findById(currentUser.storeId, paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if ((payment.payment_method_code ?? payment.method) !== 'cod' || payment.status !== 'pending') {
      throw new BadRequestException('Only pending COD payments can be marked as collected');
    }
    const updated = await this.paymentsRepository.markCollected({
      paymentId,
      storeId: currentUser.storeId,
      reviewedBy: currentUser.id,
    });
    if (!updated) {
      throw new BadRequestException('Failed to mark payment as collected');
    }
    await this.auditService.log({
      action: 'payments.cod_collected',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'payment',
      targetId: paymentId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { orderId: payment.order_id, requestId: context.requestId },
    });
    const paymentWithOrder = await this.paymentsRepository.findWithOrderById(
      currentUser.storeId,
      payment.id,
    );

    await this.outboxService.enqueue({
      aggregateType: 'payment',
      aggregateId: paymentId,
      eventType: 'payment.status_changed',
      payload: {
        paymentId,
        orderId: payment.order_id,
        orderCode: paymentWithOrder?.order_code,
        storeId: currentUser.storeId,
        amount: Number(updated.amount),
        currencyCode: paymentWithOrder?.order_currency_code,
        customerId: paymentWithOrder?.customer_id,
        method: updated.payment_method_code ?? updated.method,
        customerName: paymentWithOrder?.customer_name,
        customerPhone: paymentWithOrder?.customer_phone,
        from: payment.status,
        to: 'approved',
        source: 'cod_collected',
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });
    await this.affiliatesService.handlePaymentStatusChanged({
      storeId: currentUser.storeId,
      orderId: payment.order_id,
      nextStatus: 'approved',
    });
    return this.toResponse(updated);
  }

  private toResponse(payment: PaymentRecord): PaymentResponse {
    return {
      id: payment.id,
      storeId: payment.store_id,
      orderId: payment.order_id,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount),
      storePaymentMethodId: payment.store_payment_method_id,
      platformPaymentMethodId: payment.platform_payment_method_id,
      paymentMethodCode: payment.payment_method_code,
      paymentMethodName: payment.payment_method_name,
      accountName: payment.account_name,
      accountNumber: payment.account_number,
      phoneNumber: payment.phone_number,
      iban: payment.iban,
      instructionsAr: payment.instructions_ar,
      instructionsEn: payment.instructions_en,
      payerReference: payment.payer_reference,
      payerReceiptUrl: payment.payer_receipt_url,
      payerReceiptMediaAssetId: payment.payer_receipt_media_asset_id,
      payerNote: payment.payer_note,
      customerSubmittedAt: payment.customer_submitted_at,
      receiptUrl: payment.receipt_url,
      receiptMediaAssetId: payment.receipt_media_asset_id,
      reviewedAt: payment.reviewed_at,
      reviewedBy: payment.reviewed_by,
      reviewNote: payment.review_note,
      customerUploadedAt: payment.customer_uploaded_at,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    };
  }

  private toWithOrderResponse(payment: PaymentWithOrder): PaymentWithOrderResponse {
    return {
      ...this.toResponse(payment),
      orderCode: payment.order_code,
      orderStatus: payment.order_status,
      orderTotal: Number(payment.order_total),
    };
  }
}
