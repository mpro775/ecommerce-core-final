import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import { WebhookSigningService } from '../security/webhook-signing.service';
import type { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import type { ListWebhookDeliveriesQueryDto } from './dto/list-webhook-deliveries-query.dto';
import type { TriggerWebhookEventDto } from './dto/trigger-webhook-event.dto';
import type { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WEBHOOK_EVENTS, type WebhookEventType } from './constants/webhook-events.constants';
import { WebhooksRepository, type WebhookDeliveryWithEndpointRecord } from './webhooks.repository';

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
  deliveredAt: Date | null;
  nextRetryAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

@Injectable()
export class WebhooksService {
  private readonly maxAttempts = 5;
  private readonly requestTimeoutMs = 10000;

  constructor(
    private readonly webhooksRepository: WebhooksRepository,
    private readonly webhookSigningService: WebhookSigningService,
    private readonly auditService: AuditService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
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

    const retried = await this.sendDeliveryAttempt(delivery, delivery.attempt_number + 1);
    await this.log('webhooks.delivery_retried', currentUser, deliveryId, context);
    return this.mapDelivery(retried);
  }

  async processPendingRetries(limit = 50): Promise<{ processed: number }> {
    const pending = await this.webhooksRepository.listPendingRetries(limit);
    for (const delivery of pending) {
      await this.sendDeliveryAttempt(delivery, delivery.attempt_number + 1);
    }
    return { processed: pending.length };
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
    await this.storeCapabilitiesService.assertFeatureEnabled(storeId, 'webhooks_access');
    this.assertEventTypes([eventType]);
    const endpoints = await this.webhooksRepository.listActiveEndpointsForEvent(storeId, eventType);
    if (endpoints.length > 0) {
      await this.storeCapabilitiesService.assertMetricCanGrow(
        storeId,
        'webhooks.monthly',
        endpoints.length,
      );
    }

    for (const endpoint of endpoints) {
      const payload = this.buildPayload(storeId, eventType, data);
      const signed = this.webhookSigningService.signPayload(payload, endpoint.secret_key);
      const headerNames = this.webhookSigningService.getSignatureHeaders();
      const requestHeaders = {
        'content-type': 'application/json',
        [headerNames.signature]: signed.signature,
        [headerNames.timestamp]: signed.timestamp,
      };

      const delivery = await this.webhooksRepository.createDelivery({
        storeId,
        endpointId: endpoint.id,
        eventType,
        payload,
        signature: signed.signature,
        requestHeaders,
      });

      const hydratedDelivery: WebhookDeliveryWithEndpointRecord = {
        ...delivery,
        endpoint_url: endpoint.url,
        endpoint_secret_key: endpoint.secret_key,
      };
      await this.sendDeliveryAttempt(hydratedDelivery, 1);
    }

    if (endpoints.length > 0) {
      await this.storeCapabilitiesService.recordUsageEvent(
        storeId,
        'webhooks.monthly',
        endpoints.length,
        {
          eventType,
          endpoints: endpoints.length,
        },
      );
    }

    return endpoints.length;
  }

  private buildPayload(
    storeId: string,
    eventType: WebhookEventType,
    data: Record<string, unknown>,
  ): {
    id: string;
    eventType: string;
    timestamp: string;
    data: Record<string, unknown>;
    storeId: string;
  } {
    return {
      id: uuidv4(),
      eventType,
      timestamp: new Date().toISOString(),
      data,
      storeId,
    };
  }

  private async sendDeliveryAttempt(
    delivery: WebhookDeliveryWithEndpointRecord,
    attemptNumber: number,
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
          responseStatus: response.status,
          responseBody,
          responseHeaders,
        });

        return {
          ...delivery,
          attempt_number: attemptNumber,
          response_status: response.status,
          response_body: responseBody,
          response_headers: responseHeaders,
          error_message: null,
          next_retry_at: null,
          delivered_at: new Date(),
        };
      }

      return this.markFailedDelivery(delivery, attemptNumber, {
        responseStatus: response.status,
        responseBody,
        responseHeaders,
        errorMessage: `HTTP ${response.status}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      return this.markFailedDelivery(delivery, attemptNumber, {
        responseStatus: null,
        responseBody: null,
        responseHeaders: null,
        errorMessage: message,
      });
    }
  }

  private async markFailedDelivery(
    delivery: WebhookDeliveryWithEndpointRecord,
    attemptNumber: number,
    input: {
      responseStatus: number | null;
      responseBody: string | null;
      responseHeaders: Record<string, unknown> | null;
      errorMessage: string;
    },
  ): Promise<WebhookDeliveryWithEndpointRecord> {
    const nextRetryAt =
      attemptNumber < this.maxAttempts
        ? new Date(Date.now() + this.retryDelayMs(attemptNumber))
        : null;

    await this.webhooksRepository.markDeliveryFailure({
      deliveryId: delivery.id,
      endpointId: delivery.endpoint_id,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      responseHeaders: input.responseHeaders,
      errorMessage: input.errorMessage,
      nextRetryAt,
      nextAttemptNumber: attemptNumber,
    });

    return {
      ...delivery,
      attempt_number: attemptNumber,
      response_status: input.responseStatus,
      response_body: input.responseBody,
      response_headers: input.responseHeaders,
      error_message: input.errorMessage,
      next_retry_at: nextRetryAt,
    };
  }

  private retryDelayMs(attemptNumber: number): number {
    return Math.min(60_000, attemptNumber * 5_000);
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
    attempt_number: number;
    delivered_at: Date | null;
    next_retry_at: Date | null;
    error_message: string | null;
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
      attemptNumber: row.attempt_number,
      deliveredAt: row.delivered_at,
      nextRetryAt: row.next_retry_at,
      errorMessage: row.error_message,
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
