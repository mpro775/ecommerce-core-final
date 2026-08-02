import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AuditService } from '../audit/audit.service';
import { CommercialCommandIdempotencyService } from '../commercial/commercial-command-idempotency.service';
import { CommercialDomainException, requireCommercialPermission, requireReason } from '../commercial/commercial.errors';
import type { CommercialCommandInput } from '../commercial/commercial.types';
import { DatabaseService } from '../database/database.service';
import { OutboxService } from '../messaging/outbox.service';
import { MetricsService } from '../observability/metrics.service';
import type { PaymentStatus } from './constants/payment.constants';
import type { PaymentCommandDto } from './dto/payment-command.dto';
import { PAYMENT_COMMAND_RULES, type PaymentCommand } from './payment-transition.rules';

interface PaymentTransitionInput extends CommercialCommandInput {
  paymentId: string;
  command: PaymentCommand;
  expectedVersion?: number;
  proof?: Pick<PaymentCommandDto, 'mediaAssetId' | 'payerReference' | 'payerNote' | 'collectionReference'>;
}

interface LockedPayment {
  id: string; store_id: string; order_id: string; method: string; payment_method_code: string | null;
  status: PaymentStatus; amount: string; paid_amount: string; refunded_amount: string;
  version: string; submission_version: number; payer_receipt_media_asset_id: string | null;
  payer_reference: string | null; expires_at: Date | null;
  order_status: string; fulfillment_status: string;
}

@Injectable()
export class PaymentTransitionService {
  constructor(private readonly database: DatabaseService,
    private readonly idempotency: CommercialCommandIdempotencyService,
    private readonly audit: AuditService, private readonly outbox: OutboxService,
    private readonly affiliates: AffiliatesService, private readonly metrics: MetricsService) {}

  async execute(input: PaymentTransitionInput): Promise<Record<string, unknown>> {
    const client = await this.database.db.connect();
    try {
      await client.query('BEGIN');
      const claim = await this.idempotency.claim(client, { storeId: input.storeId,
        operation: `payment.${input.command}`, key: input.idempotencyKey, actorId: input.actor.id,
        payload: { paymentId: input.paymentId, command: input.command,
          expectedVersion: input.expectedVersion ?? null, reason: input.reason?.trim() ?? null,
          proof: input.proof ?? null } });
      if (claim.kind === 'replay') { await client.query('COMMIT'); return claim.responseBody; }
      const paymentResult = await client.query<LockedPayment>(
        `SELECT p.id,p.store_id,p.order_id,p.method,p.payment_method_code,p.status,p.amount,
                p.paid_amount,p.refunded_amount,p.version::text,p.submission_version,
                p.payer_receipt_media_asset_id,p.payer_reference,p.expires_at,
                o.status order_status,o.fulfillment_status
         FROM payments p JOIN orders o ON o.id=p.order_id AND o.store_id=p.store_id
         WHERE p.store_id=$1 AND p.id=$2 FOR UPDATE OF p,o`, [input.storeId, input.paymentId]);
      const payment = paymentResult.rows[0];
      if (!payment) throw new NotFoundException('Payment not found');
      const rule = PAYMENT_COMMAND_RULES[input.command];
      requireCommercialPermission(input.actor.permissions, rule.permission);
      const reason = rule.reasonRequired ? requireReason(input.reason) : input.reason?.trim() ?? null;
      if (!rule.from.includes(payment.status)) {
        this.metrics.incrementCounter('payment_transition_conflict_total', { store_id: input.storeId,
          command: input.command });
        throw new CommercialDomainException('PAYMENT_TRANSITION_NOT_ALLOWED',
          `Cannot ${input.command} from ${payment.status}`);
      }
      if (input.expectedVersion !== undefined && Number(payment.version) !== input.expectedVersion) {
        throw new CommercialDomainException('PAYMENT_TRANSITION_CONFLICT', 'Payment version does not match');
      }
      const method = payment.payment_method_code ?? payment.method;
      if (['submitPaymentProof', 'resubmitPaymentProof'].includes(input.command)) {
        if (method === 'cod') throw new CommercialDomainException('PAYMENT_METHOD_NOT_SUPPORTED', 'COD does not accept proof');
        await this.validateProof(client, input, payment);
      }
      if (input.command === 'collectCodPayment') {
        if (method !== 'cod') throw new CommercialDomainException('PAYMENT_METHOD_NOT_SUPPORTED', 'Payment is not COD');
        if (payment.order_status !== 'confirmed' || payment.fulfillment_status !== 'fulfilled') {
          throw new CommercialDomainException('PAYMENT_ORDER_GATE_NOT_SATISFIED',
            'COD collection requires confirmed and fulfilled order');
        }
      }
      if (input.command === 'expirePayment' && (!payment.expires_at || payment.expires_at > new Date())) {
        throw new CommercialDomainException('PAYMENT_NOT_EXPIRED', 'Payment expiration is not due');
      }
      if (input.command === 'cancelPayment' && payment.status === 'under_review' &&
          !['unfulfilled', 'cancelled'].includes(payment.fulfillment_status)) {
        throw new CommercialDomainException('PAYMENT_ORDER_GATE_NOT_SATISFIED',
          'A payment under review cannot be cancelled after fulfillment starts');
      }

      const proofAsset = input.proof?.mediaAssetId ? await client.query<{ public_url: string }>(
        'SELECT public_url FROM media_assets WHERE store_id=$1 AND id=$2',
        [input.storeId, input.proof.mediaAssetId]) : null;
      if (input.proof?.mediaAssetId && !proofAsset?.rows[0]) throw new NotFoundException('Media asset not found');
      const paid = ['approvePayment', 'collectCodPayment'].includes(input.command);
      const submission = ['submitPaymentProof', 'resubmitPaymentProof'].includes(input.command);
      const review = input.command === 'startPaymentReview';
      const changed = await client.query<{ version: string; submission_version: number }>(
        `UPDATE payments SET status=$5,
           paid_amount=CASE WHEN $6 THEN amount ELSE paid_amount END,
           submission_version=CASE WHEN $7 THEN submission_version+1 ELSE submission_version END,
           payer_receipt_media_asset_id=CASE WHEN $7 THEN COALESCE($8,payer_receipt_media_asset_id) ELSE payer_receipt_media_asset_id END,
           payer_receipt_url=CASE WHEN $7 THEN COALESCE($9,payer_receipt_url) ELSE payer_receipt_url END,
           receipt_media_asset_id=CASE WHEN $7 THEN COALESCE($8,receipt_media_asset_id) ELSE receipt_media_asset_id END,
           receipt_url=CASE WHEN $7 THEN COALESCE($9,receipt_url) ELSE receipt_url END,
           payer_reference=CASE WHEN $7 THEN COALESCE($10,payer_reference) ELSE payer_reference END,
           payer_note=CASE WHEN $7 THEN COALESCE($11,payer_note) ELSE payer_note END,
           customer_submitted_at=CASE WHEN $7 THEN NOW() ELSE customer_submitted_at END,
           reviewed_by=CASE WHEN $12 OR $6 OR $13 THEN $14 ELSE reviewed_by END,
           review_started_at=CASE WHEN $12 THEN NOW() ELSE review_started_at END,
           reviewed_at=CASE WHEN $6 OR $13 THEN NOW() ELSE reviewed_at END,
           review_note=CASE WHEN $13 THEN $15 ELSE review_note END,
           collected_at=CASE WHEN $16 THEN NOW() ELSE collected_at END,
           collection_reference=CASE WHEN $16 THEN $17 ELSE collection_reference END,
           version=version+1,status_version=status_version+1,updated_at=NOW()
         WHERE id=$1 AND store_id=$2 AND status=$3 AND version=$4::bigint
         RETURNING version::text,submission_version`,
        [input.paymentId,input.storeId,payment.status,payment.version,rule.to,paid,submission,
         input.proof?.mediaAssetId ?? null,proofAsset?.rows[0]?.public_url ?? null,
         input.proof?.payerReference?.trim() ?? null,input.proof?.payerNote?.trim() ?? null,
         review,input.command==='rejectPayment',input.actor.id,reason,
         input.command==='collectCodPayment',input.proof?.collectionReference?.trim() ?? null]);
      if (!changed.rows[0]) throw new CommercialDomainException('PAYMENT_TRANSITION_CONFLICT', 'Payment changed concurrently');
      if (paid) {
        await client.query(`UPDATE orders SET paid_amount=$3,version=version+1,updated_at=NOW()
          WHERE id=$1 AND store_id=$2`, [payment.order_id,input.storeId,payment.amount]);
        await this.affiliates.handlePaymentStatusChangedInTransaction(client, {
          storeId: input.storeId, orderId: payment.order_id, nextStatus: 'approved' });
      }
      const businessKey = `payment:${payment.id}:${input.command}:${payment.version}`;
      await client.query(
        `INSERT INTO payment_status_history (
           id,store_id,payment_id,order_id,from_status,to_status,reviewed_by,review_note,
           business_key,command,actor_type,reason_code,reason,request_id,idempotency_record_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (store_id,business_key) DO NOTHING`,
        [uuidv4(),input.storeId,payment.id,payment.order_id,payment.status,rule.to,
         input.actor.type==='admin'?input.actor.id:null,reason,businessKey,input.command,input.actor.type,
         reason?'operator_reason':null,reason,input.context?.requestId??null,claim.recordId]);
      await this.audit.log({ action: `payments.${input.command}`,storeId: input.storeId,
        storeUserId: input.actor.type==='admin'?input.actor.id:null,targetType:'payment',targetId:payment.id,
        beforeSnapshot:{status:payment.status},afterSnapshot:{status:rule.to},
        metadata:{requestId:input.context?.requestId??null,reason} },client);
      await this.outbox.enqueueInTransaction(client,{aggregateType:'payment',aggregateId:payment.id,
        eventType:rule.eventType,deduplicationKey:businessKey,
        payload:{storeId:input.storeId,paymentId:payment.id,orderId:payment.order_id,
          fromStatus:payment.status,toStatus:rule.to,command:input.command,
          amount:Number(payment.amount),currencyCode:null,
          actor:{id:input.actor.id,type:input.actor.type},reasonCode:reason?'operator_reason':null,
          requestId:input.context?.requestId??null}});
      const response={id:payment.id,orderId:payment.order_id,status:rule.to,
        paidAmount:paid?Number(payment.amount):Number(payment.paid_amount),
        version:changed.rows[0].version,submissionVersion:changed.rows[0].submission_version};
      await this.idempotency.complete(client,{recordId:claim.recordId,orderId:payment.order_id,responseBody:response});
      await client.query('COMMIT');
      this.metrics.incrementCounter('payment_transition_success_total',{store_id:input.storeId,command:input.command});
      if (input.command === 'expirePayment') {
        this.metrics.incrementCounter('payment_expired_total', { store_id: input.storeId });
      }
      return response;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async validateProof(db: { query:<T=unknown>(sql:string,values?:unknown[])=>Promise<{rows:T[]}> },
    input: PaymentTransitionInput,payment: LockedPayment) {
    const media=input.proof?.mediaAssetId??null; const reference=input.proof?.payerReference?.trim()??null;
    if (!media && !reference) throw new CommercialDomainException('PAYMENT_PROOF_REQUIRED','Receipt or payer reference is required',400);
    if (input.command==='resubmitPaymentProof' && media===payment.payer_receipt_media_asset_id &&
        reference===payment.payer_reference) {
      throw new CommercialDomainException('PAYMENT_NEW_SUBMISSION_REQUIRED','Resubmission must contain new proof metadata',400);
    }
    if (media) {
      const result=await db.query('SELECT 1 FROM media_assets WHERE store_id=$1 AND id=$2',[input.storeId,media]);
      if (!result.rows[0]) throw new NotFoundException('Media asset not found');
    }
  }
}
