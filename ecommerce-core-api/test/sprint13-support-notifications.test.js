require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { SupportService } = require('../dist/support/support.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');

describe('Sprint 13 support + notifications', () => {
  it('creates store inbox notification when customer creates B2C support ticket', async () => {
    const ticket = {
      id: 'ticket-1',
      store_id: 'store-1',
      scope: 'b2c',
      source: 'customer_portal',
      subject: 'Where is my order?',
      description: null,
      status: 'open',
      priority: 'medium',
      requester_type: 'customer',
      requester_customer_id: 'customer-1',
      requester_store_user_id: null,
      requester_label: 'John',
      requester_customer_name: 'John',
      requester_store_user_name: null,
      assigned_to_type: null,
      assigned_to_store_user_id: null,
      assigned_to_label: null,
      assigned_store_user_name: null,
      sla_first_response_due_at: new Date(),
      sla_resolve_due_at: new Date(),
      first_response_at: null,
      resolved_at: null,
      closed_at: null,
      last_message_at: new Date(),
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    const supportRepository = {
      async findSlaPolicy() {
        return { first_response_minutes: 120, resolution_minutes: 2880 };
      },
      async createTicket() {
        return ticket;
      },
      async insertMessage() {},
      async insertTicketEvent() {},
    };

    const notificationCalls = [];
    const notificationsService = {
      async createInboxNotification(input) {
        notificationCalls.push(input);
        return input;
      },
    };

    const service = new SupportService(supportRepository, notificationsService, { async log() {} });

    await service.createTicketByCustomer(
      {
        id: 'customer-1',
        storeId: 'store-1',
        phone: '700000000',
        email: 'john@example.com',
        fullName: 'John',
        sessionId: 'sess-1',
      },
      {
        priority: 'medium',
        subject: 'Where is my order?',
        message: 'Need an update please.',
      },
      {
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        requestId: 'req-1',
      },
    );

    assert.equal(notificationCalls.length, 1);
    assert.equal(notificationCalls[0].recipientType, 'store');
    assert.equal(notificationCalls[0].type, 'support.ticket.created');
  });

  it('creates low stock inbox item while processing inventory event', async () => {
    const repository = {
      async insertDelivery() {},
      async insertInboxNotification(input) {
        this.lastInbox = input;
        return {
          ...input,
          id: 'notif-1',
          recipient_label: null,
          status: 'unread',
          read_at: null,
          action_url: input.actionUrl ?? null,
          metadata: input.metadata ?? {},
          category: input.category ?? null,
          severity: input.severity ?? 'info',
          source: input.source ?? 'system',
          dedupe_key: input.dedupeKey ?? null,
          expires_at: input.expiresAt ?? null,
          created_at: new Date(),
          updated_at: new Date(),
          store_id: input.storeId,
          recipient_type: input.recipientType,
          recipient_store_user_id: input.recipientStoreUserId,
          recipient_customer_id: input.recipientCustomerId,
          title: input.title,
          body: input.body,
          type: input.type,
        };
      },
      async countUnreadForStoreBroadcast() {
        return 1;
      },
      async findStorePreference() {
        return null;
      },
      async findNotificationByDedupe() {
        return null;
      },
      lastInbox: null,
    };

    const service = new NotificationsService(
      repository,
      {
        async dispatchBackInStockNotifications() {
          return { sentCount: 0, failedCount: 0 };
        },
      },
      {
        emitNotificationCreated() {},
        async emitUnreadCount() {},
      },
    );

    await service.processEvent({
      eventType: 'inventory.low_stock',
      payload: {
        storeId: 'store-1',
        productTitle: 'T-Shirt',
      },
      attempts: 1,
    });

    assert.ok(repository.lastInbox);
    assert.equal(repository.lastInbox.type, 'inventory.low_stock');
    assert.equal(repository.lastInbox.recipientType, 'store');
    assert.equal(repository.lastInbox.category, 'inventory');
    assert.equal(repository.lastInbox.severity, 'warning');
  });

  it('creates payment receipt notification with category, severity, and dedupe key', async () => {
    const repository = createNotificationsRepositoryMock();
    const service = createNotificationsService(repository);

    await service.processEvent({
      eventType: 'payment.receipt_uploaded',
      payload: {
        storeId: 'store-1',
        paymentId: 'payment-1',
        orderId: 'order-1',
        orderCode: '123',
        amount: 35000,
        currencyCode: 'YER',
      },
      attempts: 1,
    });

    assert.equal(repository.lastInbox.type, 'payment.receipt_uploaded');
    assert.equal(repository.lastInbox.category, 'payments');
    assert.equal(repository.lastInbox.severity, 'warning');
    assert.equal(repository.lastInbox.dedupeKey, 'payment.receipt_uploaded:payment-1');
    assert.match(repository.lastInbox.body, /#123/);
  });

  it('does not create an inbox notification when preference is mute', async () => {
    const repository = createNotificationsRepositoryMock({
      preference: {
        frequency: 'mute',
        is_enabled: true,
      },
    });
    const service = createNotificationsService(repository);

    await service.processEvent({
      eventType: 'order.created',
      payload: { storeId: 'store-1', orderId: 'order-1', orderCode: '10025' },
      attempts: 1,
    });

    assert.equal(repository.insertInboxCalls, 0);
  });

  it('does not duplicate an inbox notification when dedupe key already exists', async () => {
    const repository = createNotificationsRepositoryMock({
      existingDedupe: {
        id: 'notif-existing',
        store_id: 'store-1',
        recipient_type: 'store',
        recipient_store_user_id: null,
        recipient_customer_id: null,
        recipient_label: null,
        type: 'order.created',
        category: 'orders',
        severity: 'info',
        source: 'event',
        dedupe_key: 'order.created:order-1',
        expires_at: null,
        title: 'طلب جديد',
        body: 'موجود',
        status: 'unread',
        read_at: null,
        action_url: null,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const service = createNotificationsService(repository);

    await service.processEvent({
      eventType: 'order.created',
      payload: { storeId: 'store-1', orderId: 'order-1', orderCode: '10025' },
      attempts: 1,
    });

    assert.equal(repository.insertInboxCalls, 0);
  });

  it('creates a customer inbox item from order status events when customerId is present', async () => {
    const repository = createNotificationsRepositoryMock();
    const service = createNotificationsService(repository);

    await service.processEvent({
      eventType: 'order.status.changed',
      payload: {
        storeId: 'store-1',
        customerId: 'customer-1',
        orderId: 'order-1',
        orderCode: '10025',
        from: 'new',
        to: 'confirmed',
      },
      attempts: 1,
    });

    assert.equal(repository.insertInboxCalls, 2);
    assert.equal(repository.lastInbox.type, 'customer.order.status.changed');
    assert.equal(repository.lastInbox.recipientType, 'customer');
    assert.equal(repository.lastInbox.recipientCustomerId, 'customer-1');
    assert.equal(
      repository.lastInbox.dedupeKey,
      'customer.order.status.changed:customer-1:order-1:confirmed',
    );
  });

  it('ignores undefined events without creating an inbox notification', async () => {
    const repository = createNotificationsRepositoryMock();
    const service = createNotificationsService(repository);

    await service.processEvent({
      eventType: 'unknown.event',
      payload: { storeId: 'store-1' },
      attempts: 1,
    });

    assert.equal(repository.insertInboxCalls, 0);
    assert.equal(repository.deliveryCalls.length, 1);
  });
});

function createNotificationsRepositoryMock(options = {}) {
  return {
    deliveryCalls: [],
    insertInboxCalls: 0,
    lastInbox: null,
    async insertDelivery(input) {
      this.deliveryCalls.push(input);
    },
    async insertInboxNotification(input) {
      this.insertInboxCalls += 1;
      this.lastInbox = input;
      return {
        ...input,
        id: 'notif-1',
        store_id: input.storeId,
        recipient_type: input.recipientType,
        recipient_store_user_id: input.recipientStoreUserId,
        recipient_customer_id: input.recipientCustomerId,
        recipient_label: input.recipientLabel ?? null,
        category: input.category ?? null,
        severity: input.severity ?? 'info',
        source: input.source ?? 'system',
        dedupe_key: input.dedupeKey ?? null,
        expires_at: input.expiresAt ?? null,
        action_url: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        status: 'unread',
        read_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        type: input.type,
        title: input.title,
        body: input.body,
      };
    },
    async countUnreadForStoreBroadcast() {
      return 1;
    },
    async countUnreadForCustomer() {
      return 1;
    },
    async findStorePreference() {
      if (!options.preference) return null;
      return {
        id: 'pref-1',
        store_id: 'store-1',
        recipient_type: 'store',
        recipient_store_user_id: null,
        recipient_customer_id: null,
        event_type: 'order.created',
        channel: 'inbox',
        is_enabled: options.preference.is_enabled,
        frequency: options.preference.frequency,
        created_at: new Date(),
        updated_at: new Date(),
      };
    },
    async findNotificationByDedupe() {
      return options.existingDedupe ?? null;
    },
  };
}

function createNotificationsService(repository) {
  return new NotificationsService(
    repository,
    {
      async dispatchBackInStockNotifications() {
        return { sentCount: 0, failedCount: 0 };
      },
    },
    {
      emitNotificationCreated() {},
      async emitUnreadCount() {},
    },
  );
}
