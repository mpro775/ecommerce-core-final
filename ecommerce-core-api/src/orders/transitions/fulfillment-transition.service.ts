import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../../audit/audit.service';
import { CommercialCommandIdempotencyService } from '../../commercial/commercial-command-idempotency.service';
import { CommercialDomainException, requireCommercialPermission, requireReason } from '../../commercial/commercial.errors';
import { CommercialInvariantService } from '../../commercial/commercial-invariant.service';
import type { CommercialCommandInput } from '../../commercial/commercial.types';
import { DatabaseService } from '../../database/database.service';
import type { QueryExecutor } from '../../database/query-executor';
import { InventoryService } from '../../inventory/inventory.service';
import { OutboxService } from '../../messaging/outbox.service';
import { MetricsService } from '../../observability/metrics.service';
import { getFulfillmentRule, type FulfillmentCommand } from './fulfillment-transition.rules';

export interface FulfillmentTransitionInput extends CommercialCommandInput {
  orderId: string;
  command: FulfillmentCommand;
  expectedVersion?: number;
}

@Injectable()
export class FulfillmentTransitionService {
  constructor(private readonly database: DatabaseService,
    private readonly idempotency: CommercialCommandIdempotencyService,
    private readonly invariants: CommercialInvariantService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService) {}

  async execute(input: FulfillmentTransitionInput): Promise<Record<string, unknown>> {
    const client = await this.database.db.connect();
    try {
      await client.query('BEGIN');
      const claim = await this.idempotency.claim(client, {
        storeId: input.storeId, operation: `fulfillment.${input.command}`,
        key: input.idempotencyKey, actorId: input.actor.id,
        payload: { orderId: input.orderId, command: input.command,
          expectedVersion: input.expectedVersion ?? null, reason: input.reason?.trim() ?? null },
      });
      if (claim.kind === 'replay') {
        await client.query('COMMIT');
        return claim.responseBody;
      }
      const state = await this.invariants.loadLockedOrder(client, input.storeId, input.orderId);
      if (state.order.status !== 'confirmed') {
        throw new CommercialDomainException('FULFILLMENT_ORDER_NOT_CONFIRMED', 'Order must be confirmed');
      }
      if (input.expectedVersion !== undefined && Number(state.order.version) !== input.expectedVersion) {
        throw new CommercialDomainException('FULFILLMENT_TRANSITION_CONFLICT', 'Order version does not match');
      }
      let rule;
      try {
        rule = getFulfillmentRule(input.command, state.order.fulfillment_type,
          state.order.fulfillment_status);
      } catch {
        throw new CommercialDomainException('FULFILLMENT_TRANSITION_NOT_ALLOWED',
          `Cannot ${input.command} for ${state.order.fulfillment_type}/${state.order.fulfillment_status}`);
      }
      requireCommercialPermission(input.actor.permissions, rule.permission);
      const reason = rule.reasonRequired ? requireReason(input.reason) : input.reason?.trim() ?? null;
      if (rule.paymentGate) {
        try {
          this.invariants.assertFulfillmentPaymentGate(state);
        } catch (error) {
          this.metrics.incrementCounter('fulfillment_payment_gate_block_total', {
            store_id: input.storeId,
          });
          throw error;
        }
      }

      if (input.command === 'markReady') await this.consumeReservations(client, input, state.reservations);
      if (input.command === 'cancelFulfillment') {
        await this.inventory.releaseOrderReservations(client, {
          storeId: input.storeId, orderId: input.orderId, reason: 'fulfillment_cancelled',
          actorId: input.actor.id, actorType: input.actor.type,
        });
      }
      if (['dispatch', 'retryDispatch'].includes(input.command)) this.assertShippingComplete(state.order.shipping_address);

      const changed = await client.query<{ version: string }>(
        `UPDATE orders SET fulfillment_status = $5, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND store_id = $2 AND fulfillment_status = $3 AND version = $4::bigint
         RETURNING version::text`,
        [input.orderId, input.storeId, state.order.fulfillment_status, state.order.version, rule.to],
      );
      if (!changed.rows[0]) {
        throw new CommercialDomainException('FULFILLMENT_TRANSITION_CONFLICT', 'Fulfillment changed concurrently');
      }
      const businessKey = `fulfillment:${input.orderId}:${input.command}:${state.order.version}`;
      await client.query(
        `INSERT INTO fulfillment_status_history (
           id, order_id, store_id, fulfillment_type, from_status, to_status, command,
           actor_id, actor_type, reason_code, reason, override_permission, request_id,
           idempotency_record_id, business_key
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (store_id, business_key) DO NOTHING`,
        [uuidv4(), input.orderId, input.storeId, state.order.fulfillment_type,
         state.order.fulfillment_status, rule.to, input.command, input.actor.id, input.actor.type,
         reason ? 'operator_reason' : null, reason,
         input.command === 'overrideStartPreparing' ? 'orders:override-payment-gate' : null,
         input.context?.requestId ?? null, claim.recordId, businessKey],
      );
      await this.audit.log({ action: `fulfillment.${input.command}`, storeId: input.storeId,
        storeUserId: input.actor.type === 'admin' ? input.actor.id : null,
        targetType: 'order_fulfillment', targetId: input.orderId,
        beforeSnapshot: { status: state.order.fulfillment_status }, afterSnapshot: { status: rule.to },
        metadata: { requestId: input.context?.requestId ?? null, reason,
          overridePermission: input.command === 'overrideStartPreparing' ? rule.permission : null },
      }, client);
      await this.outbox.enqueueInTransaction(client, { aggregateType: 'fulfillment',
        aggregateId: input.orderId, eventType: rule.eventType,
        deduplicationKey: businessKey,
        payload: { storeId: input.storeId, orderId: input.orderId,
          fulfillmentType: state.order.fulfillment_type, fromStatus: state.order.fulfillment_status,
          toStatus: rule.to, command: input.command, actor: { id: input.actor.id, type: input.actor.type },
          reasonCode: reason ? 'operator_reason' : null, requestId: input.context?.requestId ?? null },
      });
      const response = { id: input.orderId, fulfillmentType: state.order.fulfillment_type,
        fulfillmentStatus: rule.to, version: changed.rows[0].version };
      await this.idempotency.complete(client, { recordId: claim.recordId,
        orderId: input.orderId, responseBody: response });
      await client.query('COMMIT');
      this.metrics.incrementCounter('fulfillment_transition_success_total', {
        store_id: input.storeId, command: input.command,
      });
      if (input.command === 'overrideStartPreparing') {
        this.metrics.incrementCounter('commercial_override_total', {
          store_id: input.storeId,
          command: input.command,
        });
      }
      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      this.metrics.incrementCounter('fulfillment_transition_rejected_total', {
        store_id: input.storeId, command: input.command,
      });
      throw error;
    } finally { client.release(); }
  }

  private async consumeReservations(db: QueryExecutor, input: FulfillmentTransitionInput,
    reservations: Array<{ id: string; variant_id: string; warehouse_id: string | null; quantity: number; status: string }>) {
    const active = reservations.filter((reservation) => reservation.status === 'active');
    const items = await db.query<{ variant_id: string; quantity: number; sku: string }>(
      `SELECT oi.variant_id, SUM(oi.quantity)::int quantity, MIN(oi.sku) sku
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.store_id = $1 AND oi.order_id = $2 AND p.stock_unlimited = FALSE
       GROUP BY oi.variant_id`, [input.storeId, input.orderId]);
    if (items.rows.length > 0 && active.length === 0) {
      throw new CommercialDomainException('FULFILLMENT_RESERVATION_NOT_ACTIVE', 'Active reservation is required');
    }
    await this.inventory.confirmReservedOrderItems(db, { storeId: input.storeId,
      orderId: input.orderId, actorId: input.actor.id, items: items.rows.map((row) => ({
        variantId: row.variant_id, quantity: row.quantity, sku: row.sku,
      })) });
    for (const reservation of active) {
      await db.query(
        `INSERT INTO inventory_reservation_events (
           id,reservation_id,store_id,order_id,variant_id,warehouse_id,event_type,quantity,
           from_status,to_status,actor_id,actor_type,reason_code,business_key
         ) VALUES ($1,$2,$3,$4,$5,$6,'consumed',$7,'active','consumed',$8,$9,'fulfillment_ready',$10)
         ON CONFLICT (store_id,business_key) DO NOTHING`,
        [uuidv4(), reservation.id, input.storeId, input.orderId, reservation.variant_id,
         reservation.warehouse_id, reservation.quantity, input.actor.id, input.actor.type,
         `reservation:${reservation.id}:consume`]);
    }
  }

  private assertShippingComplete(address: Record<string, unknown>) {
    if (!address || typeof address !== 'object' || !address.addressLine) {
      throw new CommercialDomainException('FULFILLMENT_SHIPPING_DATA_INCOMPLETE',
        'Delivery address is incomplete');
    }
  }
}
