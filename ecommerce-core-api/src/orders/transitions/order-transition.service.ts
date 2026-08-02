import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AffiliatesService } from '../../affiliates/affiliates.service';
import { AuditService } from '../../audit/audit.service';
import { CommercialCommandIdempotencyService } from '../../commercial/commercial-command-idempotency.service';
import { CommercialDomainException, requireCommercialPermission, requireReason } from '../../commercial/commercial.errors';
import { CommercialInvariantService } from '../../commercial/commercial-invariant.service';
import { DatabaseService } from '../../database/database.service';
import type { QueryExecutor } from '../../database/query-executor';
import { InventoryService } from '../../inventory/inventory.service';
import { LoyaltyService } from '../../loyalty/loyalty.service';
import { OutboxService } from '../../messaging/outbox.service';
import { MetricsService } from '../../observability/metrics.service';
import { PromotionsService } from '../../promotions/promotions.service';
import { orderRule } from './order-transition.rules';
import type { OrderTransitionInput, OrderTransitionResult } from './order-transition.types';

@Injectable()
export class OrderTransitionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly idempotency: CommercialCommandIdempotencyService,
    private readonly invariants: CommercialInvariantService,
    private readonly inventory: InventoryService,
    private readonly promotions: PromotionsService,
    private readonly loyalty: LoyaltyService,
    private readonly affiliates: AffiliatesService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
  ) {}

  confirmOrder(input: Omit<OrderTransitionInput, 'command'>): Promise<OrderTransitionResult> {
    return this.transition({ ...input, command: 'confirmOrder' });
  }

  cancelOrder(input: Omit<OrderTransitionInput, 'command'>): Promise<OrderTransitionResult> {
    return this.transition({ ...input, command: 'cancelOrder' });
  }

  completeOrder(input: Omit<OrderTransitionInput, 'command'>): Promise<OrderTransitionResult> {
    return this.transition({ ...input, command: 'completeOrder' });
  }

  async transition(input: OrderTransitionInput): Promise<OrderTransitionResult> {
    const client = await this.database.db.connect();
    const operation = this.operation(input.command);
    try {
      await client.query('BEGIN');
      const claim = await this.idempotency.claim(client, {
        storeId: input.storeId,
        operation,
        key: input.idempotencyKey,
        actorId: input.actor.id,
        payload: {
          orderId: input.orderId,
          command: input.command,
          expectedVersion: input.expectedVersion ?? null,
          reason: input.reason?.trim() ?? null,
        },
      });
      if (claim.kind === 'replay') {
        await client.query('COMMIT');
        return claim.responseBody as OrderTransitionResult;
      }

      const state = await this.invariants.loadLockedOrder(client, input.storeId, input.orderId);
      if (input.expectedVersion !== undefined && Number(state.order.version) !== input.expectedVersion) {
        throw new CommercialDomainException('ORDER_TRANSITION_CONFLICT', 'Order version does not match');
      }
      const rule = orderRule(input.command, state.order.status);
      requireCommercialPermission(input.actor.permissions, rule.permission);
      const reason = rule.requiresReason ? requireReason(input.reason) : input.reason?.trim() ?? null;
      if (state.order.status !== rule.from) {
        this.metrics.incrementCounter('order_transition_rejected_total', {
          store_id: input.storeId,
          command: input.command,
        });
        const code = state.order.status === 'cancelled'
          ? 'ORDER_ALREADY_CANCELLED'
          : state.order.status === 'completed'
            ? 'ORDER_ALREADY_COMPLETED'
            : 'ORDER_TRANSITION_NOT_ALLOWED';
        throw new CommercialDomainException(code, `Cannot ${input.command} from ${state.order.status}`);
      }

      if (input.command === 'confirmOrder') this.invariants.assertConfirmable(state);
      if (input.command === 'completeOrder') this.invariants.assertCompletable(state);
      if (input.command === 'cancelOrder') {
        await this.applyCancellationEffects(client, input, state, reason ?? 'order_cancelled', claim.recordId);
        if (state.order.fulfillment_status !== 'cancelled') {
          await client.query(
            `INSERT INTO fulfillment_status_history (
              id,order_id,store_id,fulfillment_type,from_status,to_status,command,
              actor_id,actor_type,reason_code,reason,request_id,idempotency_record_id,business_key)
             VALUES ($1,$2,$3,$4,$5,'cancelled','cancelFulfillment',$6,$7,
              'order_cancelled',$8,$9,$10,$11) ON CONFLICT (store_id,business_key) DO NOTHING`,
            [uuidv4(),input.orderId,input.storeId,state.order.fulfillment_type,
              state.order.fulfillment_status,input.actor.id,input.actor.type,reason,
              input.context?.requestId??null,claim.recordId,
              `fulfillment:${input.orderId}:order_cancelled`]);

          await this.outbox.enqueueInTransaction(client, {
            aggregateType: 'fulfillment',
            aggregateId: input.orderId,
            eventType: 'fulfillment.cancelled',
            deduplicationKey: `fulfillment.cancelled:${input.orderId}:order_cancelled`,
            payload: {
              orderId: input.orderId,
              fulfillmentType: state.order.fulfillment_type,
              fromStatus: state.order.fulfillment_status,
              toStatus: 'cancelled',
              reason: reason ?? 'order_cancelled',
              actorType: input.actor.type,
              actorId: input.actor.id,
              occurredAt: new Date().toISOString(),
            },
          });
        }
      }

      const updated = await client.query<{
        id: string; order_code: string; status: OrderTransitionResult['status'];
        fulfillment_status: string; version: string;
      }>(
        `UPDATE orders
         SET status = $5,
             fulfillment_status = CASE WHEN $5 = 'cancelled' THEN 'cancelled' ELSE fulfillment_status END,
             confirmed_at = CASE WHEN $5 = 'confirmed' THEN NOW() ELSE confirmed_at END,
             completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END,
             cancelled_at = CASE WHEN $5 = 'cancelled' THEN NOW() ELSE cancelled_at END,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1 AND store_id = $2 AND status = $3 AND version = $4::bigint
         RETURNING id, order_code, status, fulfillment_status, version::text`,
        [input.orderId, input.storeId, rule.from, state.order.version, rule.to],
      );
      const order = updated.rows[0];
      if (!order) {
        this.metrics.incrementCounter('order_transition_conflict_total', {
          store_id: input.storeId,
          command: input.command,
        });
        throw new CommercialDomainException('ORDER_TRANSITION_CONFLICT', 'Order changed concurrently');
      }

      await this.insertHistory(client, input, rule.from, rule.to, reason, claim.recordId);
      await this.audit.log({
        action: `orders.${operation.split('.')[1]}`,
        storeId: input.storeId,
        storeUserId: input.actor.type === 'admin' ? input.actor.id : null,
        targetType: 'order',
        targetId: input.orderId,
        ipAddress: input.context?.ipAddress ?? null,
        userAgent: input.context?.userAgent ?? null,
        beforeSnapshot: { status: rule.from },
        afterSnapshot: { status: rule.to },
        metadata: { requestId: input.context?.requestId ?? null, command: input.command, reason },
      }, client);
      await this.enqueueEvents(client, input, state.order.order_code, rule.from, rule.to);

      if (input.command === 'completeOrder') {
        await this.loyalty.handleOrderCompletedInTransaction(client, {
          storeId: input.storeId,
          orderId: input.orderId,
          createdByStoreUserId: input.actor.id,
        });
      }
      await this.affiliates.handleOrderStatusChangedInTransaction(client, {
        storeId: input.storeId,
        orderId: input.orderId,
        nextStatus: rule.to,
      });

      const response: OrderTransitionResult = {
        id: order.id,
        orderNumber: order.order_code,
        status: order.status,
        fulfillmentStatus: order.fulfillment_status,
        version: order.version,
      };
      await this.idempotency.complete(client, {
        recordId: claim.recordId,
        orderId: input.orderId,
        responseBody: response,
      });
      await client.query('COMMIT');
      this.metrics.incrementCounter('order_transition_success_total', {
        store_id: input.storeId,
        command: input.command,
      });
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyCancellationEffects(
    db: QueryExecutor,
    input: OrderTransitionInput,
    state: Awaited<ReturnType<CommercialInvariantService['loadLockedOrder']>>,
    reason: string,
    idempotencyRecordId: string,
  ): Promise<void> {
    if (state.order.fulfillment_status === 'fulfilled') {
      throw new CommercialDomainException('ORDER_TRANSITION_NOT_ALLOWED', 'Fulfilled orders require refund/return workflow');
    }
    if (state.payment?.status === 'approved' || state.payment?.status.includes('refunded')) {
      throw new CommercialDomainException('ORDER_PAYMENT_GATE_NOT_SATISFIED', 'Paid orders require refund workflow');
    }
    const active = state.reservations.filter((row) => row.status === 'active');
    await this.inventory.releaseOrderReservations(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      reason,
      actorId: input.actor.id,
      actorType: input.actor.type,
    });
    for (const reservation of active) {
      await db.query(
        `INSERT INTO inventory_reservation_events (
           id, reservation_id, store_id, order_id, variant_id, warehouse_id,
           event_type, quantity, from_status, to_status, actor_id, actor_type,
           reason_code, business_key
         ) VALUES ($1,$2,$3,$4,$5,$6,'released',$7,'active','released',$8,$9,$10,$11)
         ON CONFLICT (store_id, business_key) DO NOTHING`,
        [uuidv4(), reservation.id, input.storeId, input.orderId, reservation.variant_id,
         reservation.warehouse_id, reservation.quantity, input.actor.id, input.actor.type,
         'order_cancelled', `reservation:${reservation.id}:release`],
      );
    }
    await this.promotions.reverseCouponInTransaction(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      reason,
    });
    await this.loyalty.handleOrderCancelledOrReturnedInTransaction(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      createdByStoreUserId: input.actor.id,
    });
    if (state.payment && ['pending', 'submitted', 'under_review'].includes(state.payment.status)) {
      const changed = await db.query(
        `UPDATE payments SET status = 'cancelled', version = version + 1,
                status_version = status_version + 1, updated_at = NOW()
         WHERE id = $1 AND store_id = $2 AND status = $3`,
        [state.payment.id, input.storeId, state.payment.status],
      );
      if ((changed.rowCount ?? 0) !== 1) {
        throw new CommercialDomainException('PAYMENT_TRANSITION_CONFLICT', 'Payment changed concurrently');
      }
      await db.query(
        `INSERT INTO payment_status_history (
           id, store_id, payment_id, order_id, from_status, to_status, reviewed_by,
           review_note, business_key, command, actor_type, reason_code, reason, request_id,
           idempotency_record_id
         ) VALUES ($1,$2,$3,$4,$5,'cancelled',$6,$7,$8,'cancelPayment',$9,'order_cancelled',$7,$10,$11)
         ON CONFLICT (store_id, business_key) DO NOTHING`,
        [uuidv4(), input.storeId, state.payment.id, input.orderId, state.payment.status,
         input.actor.id, reason, `payment:${state.payment.id}:cancel`, input.actor.type,
         input.context?.requestId ?? null, idempotencyRecordId],
      );
      await this.outbox.enqueueInTransaction(db, {
        aggregateType: 'payment', aggregateId: state.payment.id,
        eventType: 'payment.cancelled',
        deduplicationKey: `payment.cancelled:${state.payment.id}`,
        payload: { storeId: input.storeId, orderId: input.orderId, paymentId: state.payment.id },
      });
    }
  }

  private async insertHistory(
    db: QueryExecutor,
    input: OrderTransitionInput,
    from: string,
    to: string,
    reason: string | null,
    idempotencyRecordId: string,
  ): Promise<void> {
    await db.query(
      `INSERT INTO order_status_history (
         id, store_id, order_id, from_status, to_status, command, actor_id,
         actor_type, reason_code, reason, request_id, idempotency_record_id, business_key
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (store_id, business_key) DO NOTHING`,
      [uuidv4(), input.storeId, input.orderId, from, to, input.command, input.actor.id,
       input.actor.type, reason ? 'operator_reason' : null, reason,
       input.context?.requestId ?? null, idempotencyRecordId,
       `order:${input.orderId}:${input.command}`],
    );
  }

  private async enqueueEvents(
    db: QueryExecutor,
    input: OrderTransitionInput,
    orderNumber: string,
    from: string,
    to: string,
  ): Promise<void> {
    const suffix = input.command === 'confirmOrder' ? 'confirmed'
      : input.command === 'cancelOrder' ? 'cancelled' : 'completed';
    const payload = {
      storeId: input.storeId, orderId: input.orderId, orderNumber,
      fromStatus: from, toStatus: to, command: input.command,
      actor: { id: input.actor.id, type: input.actor.type },
      requestId: input.context?.requestId ?? null,
    };
    await this.outbox.enqueueInTransaction(db, {
      aggregateType: 'order', aggregateId: input.orderId,
      eventType: `order.${suffix}`,
      deduplicationKey: `order.${suffix}:${input.orderId}`,
      payload,
    });
    await this.outbox.enqueueInTransaction(db, {
      aggregateType: 'order', aggregateId: input.orderId,
      eventType: 'order.status_changed',
      deduplicationKey: `order.status_changed:${input.orderId}:${from}:${to}`,
      payload,
    });
  }

  private operation(command: OrderTransitionInput['command']): string {
    if (command === 'confirmOrder') return 'order.confirm';
    if (command === 'cancelOrder') return 'order.cancel';
    return 'order.complete';
  }
}
