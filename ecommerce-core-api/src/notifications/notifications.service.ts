import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CustomerEngagementService } from '../customers/customer-engagement.service';
import type { CustomerUser } from '../customers/interfaces/customer-user.interface';
import {
  getMerchantNotificationEvent,
  listMerchantNotificationEvents,
  type MerchantNotificationCategory,
  type MerchantNotificationEventDefinition,
  type MerchantNotificationSeverity,
} from './notification-events.registry';
import {
  NotificationsRepository,
  type NotificationInboxRecord,
  type NotificationPreferenceRecord,
  type NotificationRecipientType,
} from './notifications.repository';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly customerEngagementService: CustomerEngagementService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async processEvent(input: {
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
  }): Promise<void> {
    let payload = input.payload;
    const storeId = this.extractString(input.payload.storeId);
    const orderId = this.extractString(input.payload.orderId);

    if (input.eventType === 'inventory.back_in_stock') {
      const productId = this.extractString(input.payload.productId);
      const variantId = this.extractString(input.payload.variantId);

      if (storeId && productId) {
        const dispatch = await this.customerEngagementService.dispatchBackInStockNotifications({
          storeId,
          productId,
          ...(variantId ? { variantId } : {}),
        });
        payload = {
          ...input.payload,
          sentCount: dispatch.sentCount,
          failedCount: dispatch.failedCount,
        };
      }
    }

    const channel = this.resolveChannel(input.eventType);
    await this.notificationsRepository.insertDelivery({
      storeId: this.extractString(payload.storeId),
      orderId: this.extractString(payload.orderId),
      eventType: input.eventType,
      payload,
      channel,
      status: 'processed',
      attempts: input.attempts,
    });

    if (storeId) {
      await this.createInboxFromEventDefinition({
        storeId,
        orderId,
        eventType: input.eventType,
        payload,
      });
      await this.createCustomerInboxFromEventDefinition({
        storeId,
        orderId,
        eventType: input.eventType,
        payload,
      });
    }
  }

  async markFailure(input: {
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    errorMessage: string;
  }): Promise<void> {
    await this.notificationsRepository.insertDelivery({
      storeId: this.extractString(input.payload.storeId),
      orderId: this.extractString(input.payload.orderId),
      eventType: input.eventType,
      payload: input.payload,
      channel: this.resolveChannel(input.eventType),
      status: 'failed',
      attempts: input.attempts,
      errorMessage: input.errorMessage,
    });

    const storeId = this.extractString(input.payload.storeId);
    if (storeId) {
      await this.createInboxNotification({
        storeId,
        recipientType: 'store',
        recipientStoreUserId: null,
        recipientCustomerId: null,
        type: 'notification.delivery.failed',
        title: `Notification delivery failed: ${input.eventType}`,
        body: input.errorMessage,
        actionUrl: '/merchant?tab=notificationsCenter',
        metadata: {
          eventType: input.eventType,
          attempts: input.attempts,
        },
      });
    }
  }

  async createInboxNotification(input: {
    storeId: string | null;
    recipientType: NotificationRecipientType;
    recipientStoreUserId: string | null;
    recipientCustomerId: string | null;
    recipientLabel?: string | null;
    type: string;
    title: string;
    body: string;
    actionUrl?: string | null;
    category?: MerchantNotificationCategory | null;
    severity?: MerchantNotificationSeverity;
    source?: string | null;
    dedupeKey?: string | null;
    expiresAt?: Date | string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const definition = getMerchantNotificationEvent(input.type);
    const category = input.category ?? definition?.category ?? null;
    const severity = input.severity ?? definition?.severity ?? 'info';
    const source = input.source ?? 'system';
    const dedupeKey = input.dedupeKey ?? null;

    if (dedupeKey) {
      const existing = await this.notificationsRepository.findNotificationByDedupe({
        storeId: input.storeId,
        recipientType: input.recipientType,
        type: input.type,
        dedupeKey,
      });
      if (existing) {
        return this.mapInbox(existing);
      }
    }

    const inserted = await this.notificationsRepository.insertInboxNotification({
      storeId: input.storeId,
      recipientType: input.recipientType,
      recipientStoreUserId: input.recipientStoreUserId,
      recipientCustomerId: input.recipientCustomerId,
      type: input.type,
      category,
      severity,
      source,
      dedupeKey,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      title: input.title,
      body: input.body,
      ...(input.recipientLabel !== undefined ? { recipientLabel: input.recipientLabel } : {}),
      ...(input.actionUrl !== undefined ? { actionUrl: input.actionUrl } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    });

    const mapped = this.mapInbox(inserted);
    this.notificationsGateway.emitNotificationCreated(mapped);
    await this.emitUnreadCountForNotification(inserted);
    return mapped;
  }

  async listStoreInbox(
    currentUser: AuthUser,
    query: {
      unreadOnly: boolean;
      type?: string;
      category?: MerchantNotificationCategory;
      severity?: MerchantNotificationSeverity;
      dateFrom?: Date;
      dateTo?: Date;
      page: number;
      limit: number;
    },
  ): Promise<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const result = await this.notificationsRepository.listInboxForStore({
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      unreadOnly: query.unreadOnly,
      page: query.page,
      limit: query.limit,
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.severity !== undefined ? { severity: query.severity } : {}),
      ...(query.dateFrom !== undefined ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo !== undefined ? { dateTo: query.dateTo } : {}),
    });

    return {
      items: result.rows.map((item) => this.mapInbox(item)),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  async listCustomerInbox(
    customer: CustomerUser,
    query: {
      unreadOnly: boolean;
      type?: string;
      page: number;
      limit: number;
    },
  ): Promise<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const result = await this.notificationsRepository.listInboxForCustomer({
      storeId: customer.storeId,
      customerId: customer.id,
      unreadOnly: query.unreadOnly,
      page: query.page,
      limit: query.limit,
      ...(query.type !== undefined ? { type: query.type } : {}),
    });

    return {
      items: result.rows.map((item) => this.mapInbox(item)),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  async listPlatformInbox(query: {
    unreadOnly: boolean;
    type?: string;
    category?: MerchantNotificationCategory;
    severity?: MerchantNotificationSeverity;
    dateFrom?: Date;
    dateTo?: Date;
    page: number;
    limit: number;
  }): Promise<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const result = await this.notificationsRepository.listInboxForPlatform({
      unreadOnly: query.unreadOnly,
      page: query.page,
      limit: query.limit,
      ...(query.type !== undefined ? { type: query.type } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.severity !== undefined ? { severity: query.severity } : {}),
      ...(query.dateFrom !== undefined ? { dateFrom: query.dateFrom } : {}),
      ...(query.dateTo !== undefined ? { dateTo: query.dateTo } : {}),
    });

    return {
      items: result.rows.map((item) => this.mapInbox(item)),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  async countUnreadStoreNotifications(currentUser: AuthUser): Promise<{ count: number }> {
    return {
      count: await this.notificationsRepository.countUnreadForStore(
        currentUser.storeId,
        currentUser.id,
      ),
    };
  }

  async countUnreadCustomerNotifications(customer: CustomerUser): Promise<{ count: number }> {
    return {
      count: await this.notificationsRepository.countUnreadForCustomer(
        customer.storeId,
        customer.id,
      ),
    };
  }

  async countUnreadPlatformNotifications(): Promise<{ count: number }> {
    return {
      count: await this.notificationsRepository.countUnreadForPlatform(),
    };
  }

  async markStoreNotificationRead(currentUser: AuthUser, notificationId: string): Promise<void> {
    const updated = await this.notificationsRepository.markReadForStore({
      notificationId,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
    });
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    await this.emitStoreUnreadCount(currentUser);
    this.notificationsGateway.emitNotificationRead({
      notificationId,
      recipientType: 'store_user',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
    });
  }

  async markCustomerNotificationRead(
    customer: CustomerUser,
    notificationId: string,
  ): Promise<void> {
    const updated = await this.notificationsRepository.markReadForCustomer({
      notificationId,
      storeId: customer.storeId,
      customerId: customer.id,
    });
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    await this.emitCustomerUnreadCount(customer);
    this.notificationsGateway.emitNotificationRead({
      notificationId,
      recipientType: 'customer',
      storeId: customer.storeId,
      customerId: customer.id,
    });
  }

  async markPlatformNotificationRead(notificationId: string): Promise<void> {
    const updated = await this.notificationsRepository.markReadForPlatform(notificationId);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    await this.emitPlatformUnreadCount();
    this.notificationsGateway.emitNotificationRead({
      notificationId,
      recipientType: 'store',
    });
  }

  async markAllStoreNotificationsRead(currentUser: AuthUser): Promise<{ updated: number }> {
    const updated = await this.notificationsRepository.markAllReadForStore(
      currentUser.storeId,
      currentUser.id,
    );
    await this.emitStoreUnreadCount(currentUser);
    this.notificationsGateway.emitNotificationRead({
      recipientType: 'store_user',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
    });
    return { updated };
  }

  async markAllCustomerNotificationsRead(customer: CustomerUser): Promise<{ updated: number }> {
    const updated = await this.notificationsRepository.markAllReadForCustomer(
      customer.storeId,
      customer.id,
    );
    await this.emitCustomerUnreadCount(customer);
    this.notificationsGateway.emitNotificationRead({
      recipientType: 'customer',
      storeId: customer.storeId,
      customerId: customer.id,
    });
    return { updated };
  }

  async markAllPlatformNotificationsRead(): Promise<{ updated: number }> {
    const updated = await this.notificationsRepository.markAllReadForPlatform();
    await this.emitPlatformUnreadCount();
    this.notificationsGateway.emitNotificationRead({
      recipientType: 'store',
    });
    return { updated };
  }

  async listStorePreferences(currentUser: AuthUser): Promise<Record<string, unknown>[]> {
    const rows = await this.notificationsRepository.listPreferencesForStore({
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
    });
    const stored = new Map(
      rows.map((row) => [`${row.event_type}:${row.channel}:${row.recipient_type}`, row]),
    );
    const defaults = listMerchantNotificationEvents()
      .filter((event) => event.recipientType === 'store' || event.recipientType === 'store_user')
      .map((event) => {
        const recipientType = event.recipientType === 'store_user' ? 'store_user' : 'store';
        const key = `${event.eventType}:inbox:${recipientType}`;
        const row = stored.get(key);
        if (row) {
          return this.mapPreference(row);
        }
        return {
          id: `${event.eventType}:inbox:${recipientType}`,
          storeId: currentUser.storeId,
          recipientType,
          recipientStoreUserId: recipientType === 'store_user' ? currentUser.id : null,
          recipientCustomerId: null,
          eventType: event.eventType,
          category: event.category,
          severity: event.severity,
          channel: 'inbox',
          isEnabled: event.defaultFrequency !== 'mute',
          frequency: event.defaultFrequency,
          createdAt: null,
          updatedAt: null,
        };
      });

    const defaultKeys = new Set(
      defaults.map(
        (item) => `${String(item.eventType)}:${String(item.channel)}:${String(item.recipientType)}`,
      ),
    );
    const extraStored = rows
      .map((row) => this.mapPreference(row))
      .filter(
        (item) =>
          !defaultKeys.has(
            `${String(item.eventType)}:${String(item.channel)}:${String(item.recipientType)}`,
          ),
      );

    return [...defaults, ...extraStored];
  }

  async updateStorePreferences(
    currentUser: AuthUser,
    input: Array<{
      eventType: string;
      channel: 'inbox' | 'email';
      isEnabled: boolean;
      frequency: 'instant' | 'daily_digest' | 'mute';
      target: 'store' | 'store_user';
    }>,
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const item of input) {
      await this.notificationsRepository.upsertPreferenceForStore({
        storeId: currentUser.storeId,
        recipientType: item.target,
        recipientStoreUserId: item.target === 'store_user' ? currentUser.id : null,
        eventType: item.eventType,
        channel: item.channel,
        isEnabled: item.isEnabled,
        frequency: item.frequency,
      });
      updated += 1;
    }
    return { updated };
  }

  private resolveChannel(eventType: string): string {
    const definition = getMerchantNotificationEvent(eventType);
    if (definition?.recipientType === 'store' || definition?.recipientType === 'store_user') {
      return 'merchant';
    }
    if (definition?.recipientType === 'customer') {
      return 'customer';
    }

    return 'system';
  }

  private extractString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private async createInboxFromEventDefinition(input: {
    storeId: string;
    orderId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const definition = getMerchantNotificationEvent(input.eventType);
    if (!definition) {
      this.logger.log(`Ignored undefined notification event: ${input.eventType}`);
      return;
    }

    if (!definition.isPersistent) {
      this.logger.log(`Skipped non-persistent notification event: ${input.eventType}`);
      return;
    }

    const preference = await this.notificationsRepository.findStorePreference({
      storeId: input.storeId,
      recipientType: definition.recipientType === 'store_user' ? 'store_user' : 'store',
      recipientStoreUserId: null,
      eventType: input.eventType,
      channel: 'inbox',
    });
    const frequency = preference?.frequency ?? definition.defaultFrequency;
    const isEnabled = preference?.is_enabled ?? definition.defaultFrequency !== 'mute';

    if (!isEnabled || frequency === 'mute') {
      this.logger.log(`Skipped muted notification event: ${input.eventType}`);
      return;
    }

    if (frequency === 'daily_digest') {
      this.logger.log(
        `Skipped daily digest notification event for instant inbox: ${input.eventType}`,
      );
      return;
    }

    await this.createInboxFromDefinition({
      storeId: input.storeId,
      orderId: input.orderId,
      eventType: input.eventType,
      payload: input.payload,
      definition,
    });
  }

  private async createInboxFromDefinition(input: {
    storeId: string;
    orderId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
    definition: MerchantNotificationEventDefinition;
  }): Promise<void> {
    const dedupeKey = input.definition.dedupeKey
      ? this.renderTemplate(input.definition.dedupeKey, input.payload)
      : null;

    await this.createInboxNotification({
      storeId: input.storeId,
      recipientType: input.definition.recipientType,
      recipientStoreUserId: null,
      recipientCustomerId:
        input.definition.recipientType === 'customer'
          ? this.extractString(input.payload.customerId)
          : null,
      type: input.eventType,
      category: input.definition.category,
      severity: input.definition.severity,
      source: this.extractString(input.payload.source) ?? 'event',
      dedupeKey,
      title: this.renderTemplate(input.definition.title, input.payload),
      body: this.renderTemplate(input.definition.body, input.payload),
      ...(input.definition.actionUrl
        ? { actionUrl: this.renderTemplate(input.definition.actionUrl, input.payload) }
        : {}),
      metadata: {
        ...input.payload,
        ...(input.orderId ? { orderId: input.orderId } : {}),
      },
    });
  }

  private async createCustomerInboxFromEventDefinition(input: {
    storeId: string;
    orderId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const customerId = this.extractString(input.payload.customerId);
    if (!customerId) {
      return;
    }

    const customerEventType = this.resolveCustomerEventType(input.eventType);
    if (!customerEventType) {
      return;
    }

    const definition = getMerchantNotificationEvent(customerEventType);
    if (!definition || !definition.isPersistent || definition.defaultFrequency === 'mute') {
      return;
    }

    await this.createInboxFromDefinition({
      storeId: input.storeId,
      orderId: input.orderId,
      eventType: customerEventType,
      payload: input.payload,
      definition,
    });
  }

  private resolveCustomerEventType(eventType: string): string | null {
    if (eventType === 'order.created') {
      return 'customer.order.created';
    }
    if (eventType === 'order.updated') {
      return 'customer.order.updated';
    }
    if (eventType === 'order.status.changed') {
      return 'customer.order.status.changed';
    }
    if (eventType === 'payment.status_changed') {
      return 'customer.payment.status_changed';
    }
    return null;
  }

  private renderTemplate(template: string, payload: Record<string, unknown>): string {
    return template
      .replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
        const value = this.readTemplateValue(payload, key);
        if (value === null || value === undefined || value === '') {
          return '';
        }
        if (typeof value === 'number') {
          return new Intl.NumberFormat('en-US').format(value);
        }
        return String(value);
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  private readTemplateValue(payload: Record<string, unknown>, key: string): unknown {
    const normalizedPayload = this.withPayloadAliases(payload);
    return key.split('.').reduce<unknown>((current, part) => {
      if (current && typeof current === 'object' && part in current) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, normalizedPayload);
  }

  private withPayloadAliases(payload: Record<string, unknown>): Record<string, unknown> {
    return {
      ...payload,
      currentStock: payload.currentStock ?? payload.stockQuantity ?? payload.availableQuantity,
      threshold: payload.threshold ?? payload.lowStockThreshold,
      productTitle: payload.productTitle ?? payload.title ?? payload.sku ?? 'المنتج',
      orderCode: payload.orderCode ? `#${String(payload.orderCode).replace(/^#/, '')}` : '',
      customerName: payload.customerName ?? 'غير محدد',
      domain: payload.domain ?? payload.hostname,
      message: payload.message ?? payload.errorMessage ?? '',
    };
  }

  private async emitUnreadCountForNotification(row: NotificationInboxRecord): Promise<void> {
    if (row.recipient_type === 'store' && row.store_id) {
      this.notificationsGateway.emitUnreadCount({
        recipientType: 'store',
        storeId: row.store_id,
        count: await this.notificationsRepository.countUnreadForStoreBroadcast(row.store_id),
      });
      return;
    }

    if (row.recipient_type === 'store_user' && row.store_id && row.recipient_store_user_id) {
      this.notificationsGateway.emitUnreadCount({
        recipientType: 'store_user',
        storeId: row.store_id,
        storeUserId: row.recipient_store_user_id,
        count: await this.notificationsRepository.countUnreadForStoreUser(
          row.store_id,
          row.recipient_store_user_id,
        ),
      });
      return;
    }

    if (row.recipient_type === 'customer' && row.store_id && row.recipient_customer_id) {
      this.notificationsGateway.emitUnreadCount({
        recipientType: 'customer',
        storeId: row.store_id,
        customerId: row.recipient_customer_id,
        count: await this.notificationsRepository.countUnreadForCustomer(
          row.store_id,
          row.recipient_customer_id,
        ),
      });
      return;
    }


  }

  private async emitStoreUnreadCount(currentUser: AuthUser): Promise<void> {
    this.notificationsGateway.emitUnreadCount({
      recipientType: 'store_user',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      count: await this.notificationsRepository.countUnreadForStore(
        currentUser.storeId,
        currentUser.id,
      ),
    });
  }

  private async emitCustomerUnreadCount(customer: CustomerUser): Promise<void> {
    this.notificationsGateway.emitUnreadCount({
      recipientType: 'customer',
      storeId: customer.storeId,
      customerId: customer.id,
      count: await this.notificationsRepository.countUnreadForCustomer(
        customer.storeId,
        customer.id,
      ),
    });
  }

  private async emitPlatformUnreadCount(): Promise<void> {
    this.notificationsGateway.emitUnreadCount({
      recipientType: 'store',
      count: await this.notificationsRepository.countUnreadForPlatform(),
    });
  }

  private mapInbox(row: NotificationInboxRecord) {
    return {
      id: row.id,
      storeId: row.store_id,
      recipientType: row.recipient_type,
      recipientStoreUserId: row.recipient_store_user_id,
      recipientCustomerId: row.recipient_customer_id,
      recipientLabel: row.recipient_label,
      type: row.type,
      category: row.category,
      severity: row.severity,
      source: row.source,
      dedupeKey: row.dedupe_key,
      expiresAt: row.expires_at,
      title: row.title,
      body: row.body,
      status: row.status,
      readAt: row.read_at,
      actionUrl: row.action_url,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPreference(row: NotificationPreferenceRecord): Record<string, unknown> {
    return {
      id: row.id,
      storeId: row.store_id,
      recipientType: row.recipient_type,
      recipientStoreUserId: row.recipient_store_user_id,
      recipientCustomerId: row.recipient_customer_id,
      eventType: row.event_type,
      category: getMerchantNotificationEvent(row.event_type)?.category ?? null,
      severity: getMerchantNotificationEvent(row.event_type)?.severity ?? 'info',
      channel: row.channel,
      isEnabled: row.is_enabled,
      frequency: row.frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
