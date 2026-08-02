import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { PaymentStatus } from './constants/payment.constants';
import type { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentsRepository, type PaymentRecord, type PaymentWithOrder } from './payments.repository';
import { PAYMENT_COMMAND_RULES } from './payment-transition.rules';

export interface PaymentResponse {
  id: string; storeId: string; orderId: string; method: string; status: PaymentStatus;
  statusLabel: string; amount: string; paidAmount: string; refundedAmount: string;
  refundableAmount: string; currency: string; version: number; submissionVersion: number;
  storePaymentMethodId: string | null; paymentMethodCatalogId: string | null;
  paymentMethodCode: string | null; paymentMethodName: string | null;
  accountName: string | null; accountNumber: string | null; phoneNumber: string | null;
  iban: string | null; instructionsAr: string | null; instructionsEn: string | null;
  payerReference: string | null; payerReceiptUrl: string | null;
  payerReceiptMediaAssetId: string | null; payerNote: string | null;
  customerSubmittedAt: string | null; receiptUrl: string | null;
  receiptMediaAssetId: string | null; reviewedAt: string | null; reviewedBy: string | null;
  reviewNote: string | null; customerUploadedAt: string | null; createdAt: string; updatedAt: string;
  allowedTransitions: Array<{ command: string; toStatus: string; requiresReason: boolean }>;
}
export interface PaymentWithOrderResponse extends PaymentResponse {
  orderNumber: string; orderStatus: string; orderTotal: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly repository: PaymentsRepository) {}

  async list(user: AuthUser, query: ListPaymentsQueryDto) {
    const page=query.page??1; const limit=query.limit??20;
    const result=await this.repository.listByStore(user.storeId,{
      orderId:query.orderId,status:query.status,limit,offset:(page-1)*limit});
    return {data:result.rows.map((row)=>this.toWithOrderResponse(user,row)),
      meta:{page,limit,total:result.total,totalPages:Math.ceil(result.total/limit)}};
  }
  async listPendingReview(user: AuthUser) {
    const rows=await this.repository.listPendingReview(user.storeId);
    return {data:rows.map((row)=>this.toWithOrderResponse(user,row)),
      meta:{page:1,limit:rows.length,total:rows.length,totalPages:rows.length?1:0}};
  }
  async getByOrderId(user: AuthUser,orderId:string):Promise<PaymentResponse>{
    const row=await this.repository.findWithOrderByOrderId(user.storeId,orderId);
    if(!row)throw new NotFoundException('Payment not found'); return this.toResponse(user,row);
  }
  async getById(user: AuthUser,id:string):Promise<PaymentResponse>{
    const row=await this.repository.findWithOrderById(user.storeId,id);
    if(!row)throw new NotFoundException('Payment not found'); return this.toResponse(user,row);
  }
  private toResponse(user:AuthUser,p:PaymentRecord):PaymentResponse{
    return {id:p.id,storeId:p.store_id,orderId:p.order_id,method:p.method,status:p.status,
      statusLabel:this.label(p.status),amount:p.amount,paidAmount:p.paid_amount,
      refundedAmount:p.refunded_amount,
      refundableAmount:(Math.max(0,Number(p.paid_amount)-Number(p.refunded_amount))).toFixed(2),
      currency:p.currency_code,version:Number(p.version),submissionVersion:p.submission_version,
      storePaymentMethodId:p.store_payment_method_id,paymentMethodCatalogId:p.payment_method_catalog_id,
      paymentMethodCode:p.payment_method_code,paymentMethodName:p.payment_method_name,
      accountName:p.account_name,accountNumber:p.account_number,phoneNumber:p.phone_number,iban:p.iban,
      instructionsAr:p.instructions_ar,instructionsEn:p.instructions_en,payerReference:p.payer_reference,
      payerReceiptUrl:p.payer_receipt_url,payerReceiptMediaAssetId:p.payer_receipt_media_asset_id,
      payerNote:p.payer_note,customerSubmittedAt:p.customer_submitted_at?.toISOString()??null,
      receiptUrl:p.receipt_url,receiptMediaAssetId:p.receipt_media_asset_id,
      reviewedAt:p.reviewed_at?.toISOString()??null,reviewedBy:p.reviewed_by,reviewNote:p.review_note,
      customerUploadedAt:p.customer_uploaded_at?.toISOString()??null,
      createdAt:p.created_at.toISOString(),updatedAt:p.updated_at.toISOString(),
      allowedTransitions:this.allowedTransitions(user,p)};
  }
  private toWithOrderResponse(user:AuthUser,p:PaymentWithOrder):PaymentWithOrderResponse{return{
    ...this.toResponse(user,p),orderNumber:p.order_code,orderStatus:p.order_status,orderTotal:p.order_total};}
  private allowedTransitions(user:AuthUser,payment:PaymentRecord) {
    const has=(permission:string)=>user.permissions.includes('*')||user.permissions.includes(permission);
    const method=payment.payment_method_code??payment.method;
    const state=payment as PaymentRecord&Partial<PaymentWithOrder>;
    return Object.entries(PAYMENT_COMMAND_RULES).filter(([command,rule])=>{
      if(!rule.from.includes(payment.status)||!has(rule.permission))return false;
      if(['submitPaymentProof','resubmitPaymentProof','startPaymentReview','approvePayment','rejectPayment']
        .includes(command)&&method==='cod')return false;
      if(command==='collectCodPayment')return method==='cod'&&state.order_status==='confirmed'&&
        state.fulfillment_status==='fulfilled';
      if(command==='expirePayment')return method!=='cod'&&payment.expires_at!==null&&
        payment.expires_at<=new Date();
      if(command==='cancelPayment'&&payment.status==='under_review')
        return ['unfulfilled','cancelled'].includes(state.fulfillment_status??'');
      return true;
    }).map(([command,rule])=>({command,toStatus:rule.to,requiresReason:rule.reasonRequired}));
  }
  private label(status:PaymentStatus):string{return({pending:'Pending',submitted:'Submitted',
    under_review:'Under review',approved:'Approved',rejected:'Rejected',expired:'Expired',
    cancelled:'Cancelled',partially_refunded:'Partially refunded',refunded:'Refunded'} as const)[status];}
}
