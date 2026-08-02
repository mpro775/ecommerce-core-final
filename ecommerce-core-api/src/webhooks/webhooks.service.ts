import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { hostname } from 'node:os';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { WebhookSigningService } from '../security/webhook-signing.service';
import type { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import type { ListWebhookDeliveriesQueryDto } from './dto/list-webhook-deliveries-query.dto';
import type { TriggerWebhookEventDto } from './dto/trigger-webhook-event.dto';
import type { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WEBHOOK_EVENTS, type WebhookEventType } from './constants/webhook-events.constants';
import { WebhooksRepository, type WebhookDeliveryWithEndpointRecord } from './webhooks.repository';
import type { ClaimedOutboxEvent } from '../messaging/outbox.service';
import { OutboxService } from '../messaging/outbox.service';
import { MetricsService } from '../observability/metrics.service';

export interface WebhookEndpointResponse {
  id: string;
  storeId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryResponse {
  id: string;
  storeId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attemptNumber: number;
  status: 'pending' | 'processing' | 'delivered' | 'failed';
  deliveredAt: Date | null;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

@Injectable()
export class WebhooksService {
  private readonly requestTimeoutMs = 10000;

  constructor(
    private readonly webhooksRepository: WebhooksRepository,
    private readonly webhookSigningService: WebhookSigningService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly metricsService: MetricsService,
  ) {}

  async createEndpoint(
    currentUser: AuthUser,
    input: CreateWebhookEndpointDto,
    context: RequestContextData,
  ): Promise<WebhookEndpointResponse> {
    this.assertEventTypes(input.events);
    const endpoint = await this.webhooksRepository.createEndpoint({
      storeId: currentUser.storeId,
      name: input.name.trim(),
      url: input.url.trim(),
      secretKey: this.webhookSigningService.generateSecret(),
      events: this.normalizeEvents(input.events),
      isActive: input.isActive ?? true,
    });

    await this.log('webhooks.endpoint_created', currentUser, endpoint.id, context);
    return this.mapEndpoint(endpoint);
  }

  async listEndpoints(currentUser: AuthUser): Promise<WebhookEndpointResponse[]> {
    const rows = await this.webhooksRepository.listEndpoints(currentUser.storeId);
    return rows.map((row) => this.mapEndpoint(row));
  }

  async updateEndpoint(
    currentUser: AuthUser,
    endpointId: string,
    input: UpdateWebhookEndpointDto,
    context: RequestContextData,
  ): Promise<WebhookEndpointResponse> {
    const existing = await this.webhooksRepository.findEndpointById(
      currentUser.storeId,
      endpointId,
    );
    if (!existing) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const nextEvents = input.events ? this.normalizeEvents(input.events) : existing.events;
    this.assertEventTypes(nextEvents);

    const updated = await this.webhooksRepository.updateEndpoint({
      storeId: currentUser.storeId,
      endpointId,
      name: input.name?.trim() ?? existing.name,
      url: input.url?.trim() ?? existing.url,
      events: nextEvents,
      isActive: input.isActive ?? existing.is_active,
    });

    if (!updated) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    await this.log('webhooks.endpoint_updated', currentUser, endpointId, context);
    return this.mapEndpoint(updated);
  }

  async deleteEndpoint(
    currentUser: AuthUser,
    endpointId: string,
    context: RequestContextData,
  ): Promise<void> {
    const deleted = await this.webhooksRepository.deleteEndpoint(currentUser.storeId, endpointId);
    if (!deleted) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    await this.log('webhooks.endpoint_deleted', currentUser, endpointId, context);
  }

  async listDeliveries(currentUser: AuthUser, query: ListWebhookDeliveriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.webhooksRepository.listDeliveries({
      storeId: currentUser.storeId,
      ...(query.endpointId ? { endpointId: query.endpointId } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.status ? { status: query.status } : {}),
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => this.mapDelivery(row)),
      total: result.total,
      page,
      limit,
    };
  }

  async retryDelivery(
    currentUser: AuthUser,
    deliveryId: string,
    context: RequestContextData,
  ): Promise<WebhookDeliveryResponse> {
    const delivery = await this.webhooksRepository.findDeliveryWithEndpoint(
      currentUser.storeId,
      deliveryId,
    );
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    const retried = await this.webhooksRepository.scheduleRetry(currentUser.storeId, delivery.id);
    if (!retried) throw new BadRequestException('Delivered webhooks cannot be retried');
    await this.log('webhooks.delivery_retried', currentUser, deliveryId, context);
    return this.mapDelivery(retried);
  }

  async processPendingRetries(limit = 50): Promise<{ processed: number }> {
    return { processed: await this.processDueDeliveries(limit) };
  }

  async triggerEvent(
    currentUser: AuthUser,
    input: TriggerWebhookEventDto,
    context: RequestContextData,
  ): Promise<{ dispatchedTo: number }> {
    const dispatchedTo = await this.dispatchEvent(
      currentUser.storeId,
      input.eventType as WebhookEventType,
      {
        ...(input.data ?? {}),
        manualTrigger: true,
      },
    );

    await this.log('webhooks.event_triggered', currentUser, currentUser.storeId, context);
    return { dispatchedTo };
  }

  async dispatchEvent(
    storeId: string,
    eventType: WebhookEventType,
    data: Record<string, unknown>,
  ): Promise<number> {
    this.assertEventTypes([eventType]);
    await this.outboxService.enqueueStandalone({
      aggregateType: 'webhook-manual-event',
      aggregateId: uuidv4(),
      eventType,
      payload: { storeId, ...data },
    });
    return 1;
  }

  async processOutboxEvent(event: ClaimedOutboxEvent): Promise<void> {
    if (!WEBHOOK_EVENTS.includes(event.event_type as WebhookEventType)) return;
    const storeId = typeof event.payload.storeId === 'string' ? event.payload.storeId : null;
    if (!storeId) return;
    const endpoints = await this.webhooksRepository.listActiveEndpointsForEvent(
      storeId,
      event.event_type,
    );
    for (const endpoint of endpoints) {
      const payload = {
        id: event.id,
        eventType: event.event_type,
        timestamp: event.created_at.toISOString(),
        data: event.payload,
        storeId,
      };
      const signed = this.webhookSigningService.signPayload(payload, endpoint.secret_key);
      const headerNames = this.webhookSigningService.getSignatureHeaders();
      const requestHeaders = {
        'content-type': 'application/json',
        [headerNames.signature]: signed.signature,
        [headerNames.timestamp]: signed.timestamp,
        'x-outbox-id': event.id,
      };
      await this.webhooksRepository.createOrGetDeliveryFromOutbox({
        sourceOutboxId: event.id,
        storeId,
        endpointId: endpoint.id,
        eventType: event.event_type,
        payload,
        signature: signed.signature,
        requestHeaders,
      });
    }
  }

  async recoverStaleProcessing(): Promise<number> {
    const recovered = await this.webhooksRepository.recoverStaleProcessing(
      this.processingTimeoutSeconds(),
    );
    if (recovered > 0) {
      this.metricsService.incrementCounter('webhook_delivery_recovered_total', undefined, recovered);
    }
    return recovered;
  }

  async processDueDeliveries(
    limit = 50,
    workerId = `${hostname()}:${process.pid}:${uuidv4()}`,
  ): Promise<number> {
    const deliveries = await this.webhooksRepository.claimDueDeliveries(limit, workerId);
    if (deliveries.length > 0) {
      this.metricsService.incrementCounter('webhook_delivery_claimed_total', undefined, deliveries.length);
    }
    for (const delivery of deliveries) {
      await this.sendDeliveryAttempt(delivery, workerId);
    }
    return deliveries.length;
  }

  private async sendDeliveryAttempt(
    delivery: WebhookDeliveryWithEndpointRecord,
    workerId: string,
  ): Promise<WebhookDeliveryWithEndpointRecord> {
    const body = JSON.stringify(delivery.payload);
    const requestHeaders = this.mapHeadersToRecord(delivery.request_headers);

    try {
      const response = await fetch(delivery.endpoint_url, {
        method: 'POST',
        headers: requestHeaders,
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      const responseBody = await response.text();
      const responseHeaders = Object.fromEntries(response.headers.entries());

      if (response.ok) {
        await this.webhooksRepository.markDeliverySuccess({
          deliveryId: delivery.id,
          endpointId: delivery.endpoint_id,
          workerId,
          responseStatus: response.status,
          responseBody,
          responseHeaders,
        });

        return {
          ...delivery,
          status: 'delivered',
          attempt_count: delivery.attempt_count,
          response_status: response.status,
          response_body: responseBody,
          response_headers: responseHeaders,
          last_error: null,
          next_attempt_at: null,
          delivered_at: new Date(),
        };
      }

      return this.markFailedDelivery(delivery, workerId, {
        responseStatus: response.status,
        responseBody,
        responseHeaders,
        errorMessage: `HTTP ${response.status}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      return this.markFailedDelivery(delivery, workerId, {
        responseStatus: null,
        responseBody: null,
        responseHeaders: null,
        errorMessage: message,
      });
    }
  }

  private async markFailedDelivery(
    delivery: WebhookDeliveryWithEndpointRecord,
    workerId: string,
    input: {
      responseStatus: number | null;
      responseBody: string | null;
      responseHeaders: Record<string, unknown> | null;
      errorMessage: string;
    },
  ): Promise<WebhookDeliveryWithEndpointRecord> {
    const terminal = delivery.attempt_count >= this.maximumAttempts();
    const nextAttemptAt =
      !terminal
        ? new Date(Date.now() + this.retryDelayMs(delivery.attempt_count))
        : null;

    await this.webhooksRepository.markDeliveryFailure({
      deliveryId: delivery.id,
      endpointId: delivery.endpoint_id,
      workerId,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      responseHeaders: input.responseHeaders,
      errorMessage: input.errorMessage,
      nextAttemptAt,
      terminal,
    });

    this.metricsService.incrementCounter(
      terminal ? 'webhook_delivery_failed_total' : 'webhook_delivery_retry_total',
    );

    return {
      ...delivery,
      status: terminal ? 'failed' : 'pending',
      response_status: input.responseStatus,
      response_body: input.responseBody,
      response_headers: input.responseHeaders,
      last_error: input.errorMessage,
      next_attempt_at: nextAttemptAt,
      locked_at: null,
      locked_by: null,
    };
  }

  private retryDelayMs(attemptNumber: number): number {
    const base = Number(process.env.WEBHOOK_BASE_BACKOFF_MS ?? 5000);
    return Math.min(3_600_000, base * 2 ** Math.max(0, attemptNumber - 1));
  }

  private maximumAttempts(): number {
    const value = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 5);
    return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 5;
  }

  private processingTimeoutSeconds(): number {
    const value = Number(process.env.WEBHOOK_PROCESSING_TIMEOUT_SECONDS ?? 120);
    return Number.isInteger(value) && value >= 5 && value <= 3600 ? value : 120;
  }

  private mapHeadersToRecord(headers: Record<string, unknown>): Record<string, string> {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        mapped[key] = value;
      }
    }
    return mapped;
  }

  private mapEndpoint(row: {
    id: string;
    store_id: string;
    name: string;
    url: string;
    events: string[];
    is_active: boolean;
    last_triggered_at: Date | null;
    failure_count: number;
    created_at: Date;
    updated_at: Date;
  }): WebhookEndpointResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      url: row.url,
      events: row.events,
      isActive: row.is_active,
      lastTriggeredAt: row.last_triggered_at,
      failureCount: row.failure_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDelivery(row: {
    id: string;
    store_id: string;
    endpoint_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    response_status: number | null;
    response_body: string | null;
    status: 'pending' | 'processing' | 'delivered' | 'failed';
    attempt_count: number;
    delivered_at: Date | null;
    next_attempt_at: Date | null;
    last_error: string | null;
    created_at: Date;
  }): WebhookDeliveryResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      endpointId: row.endpoint_id,
      eventType: row.event_type,
      payload: row.payload,
      responseStatus: row.response_status,
      responseBody: row.response_body,
      status: row.status,
      attemptNumber: row.attempt_count,
      deliveredAt: row.delivered_at,
      nextRetryAt: row.next_attempt_at,
      errorMessage: row.last_error,
      createdAt: row.created_at,
    };
  }

  private normalizeEvents(events: string[]): string[] {
    return [...new Set(events.map((event) => event.trim()))];
  }

  private assertEventTypes(events: string[]): void {
    const invalid = events.filter((event) => !WEBHOOK_EVENTS.includes(event as WebhookEventType));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unsupported webhook events: ${invalid.join(', ')}`);
    }
  }

  private async log(
    action: string,
    currentUser: AuthUser,
    targetId: string,
    context: RequestContextData,
  ): Promise<void> {
    try {
      await this.auditService.log({
        action,
        storeId: currentUser.storeId,
        storeUserId: currentUser.id,
        targetType: 'webhook',
        targetId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: context.requestId ? { requestId: context.requestId } : {},
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to write audit log',
      );
    }
  }
}
