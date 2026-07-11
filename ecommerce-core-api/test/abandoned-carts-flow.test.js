const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { describe, it } = require('node:test');

const { BadRequestException } = require('@nestjs/common');
const { AbandonedCartsService } = require('../dist/customers/abandoned-carts.service');

describe('abandoned carts recovery flow', () => {
  it('captures, dispatches with cooldown, tracks open/click, and recovers checkout', async () => {
    const now = new Date();
    const storeId = randomUUID();
    const cartId = randomUUID();
    const token = 'flow-token';

    const db = {
      cart: {
        id: cartId,
        store_id: storeId,
        store_slug: 'demo',
        store_name: 'Demo',
        currency_code: 'SAR',
        customer_id: randomUUID(),
        customer_email: 'customer@example.com',
        customer_phone: '+966500000000',
        items_count: 2,
        cart_total: '200.00',
        cart_data: [
          { title: 'Item A', sku: 'A-1', quantity: 1, unitPrice: 120 },
          { title: 'Item B', sku: 'B-1', quantity: 1, unitPrice: 80 },
        ],
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        status: 'open',
      },
      abandoned: null,
      reminders: [],
    };

    const repository = {
      async listAbandonableCarts() {
        return db.cart.status === 'open' ? [db.cart] : [];
      },
      async upsertAbandonedCart(input) {
        if (!db.abandoned) {
          db.abandoned = {
            id: randomUUID(),
            store_id: input.storeId,
            cart_id: input.cartId,
            customer_email: input.customerEmail,
            customer_phone: input.customerPhone,
            cart_total: String(input.cartTotal),
            items_count: input.itemsCount,
            cart_data: input.cartData,
            recovery_token: token,
            recovery_sent_at: null,
            recovered_at: null,
            recovered_order_id: null,
            expires_at: input.expiresAt,
          };
        }
        return db.abandoned;
      },
      async markCartAsAbandoned() {
        db.cart.status = 'abandoned';
      },
      async listDispatchableAbandonedCarts(input) {
        if (!db.abandoned || db.abandoned.recovered_at) {
          return [];
        }
        const sentAt = db.abandoned.recovery_sent_at;
        if (sentAt) {
          const diffHours = (Date.now() - sentAt.getTime()) / (60 * 60 * 1000);
          if (diffHours < input.cooldownHours) {
            return [];
          }
        }
        return [
          {
            abandoned_cart_id: db.abandoned.id,
            store_id: db.abandoned.store_id,
            store_slug: db.cart.store_slug,
            store_name: db.cart.store_name,
            currency_code: db.cart.currency_code,
            cart_id: db.abandoned.cart_id,
            customer_email: db.abandoned.customer_email,
            customer_phone: db.abandoned.customer_phone,
            cart_total: db.abandoned.cart_total,
            items_count: db.abandoned.items_count,
            recovery_token: db.abandoned.recovery_token,
            cart_data: db.abandoned.cart_data,
            expires_at: db.abandoned.expires_at,
          },
        ];
      },
      async markRecoveryEmailSent() {
        db.abandoned.recovery_sent_at = new Date();
      },
      async insertReminder(input) {
        db.reminders.push({
          abandoned_cart_id: input.abandonedCartId,
          sent_at: new Date(),
          opened_at: null,
          clicked_at: null,
        });
      },
      async findRecoveryTargetByToken(requestToken) {
        if (!db.abandoned || db.abandoned.recovery_token !== requestToken) {
          return null;
        }
        return {
          abandoned_cart_id: db.abandoned.id,
          store_id: db.abandoned.store_id,
          store_slug: db.cart.store_slug,
          cart_id: db.abandoned.cart_id,
          recovery_token: db.abandoned.recovery_token,
          expires_at: db.abandoned.expires_at,
          recovered_at: db.abandoned.recovered_at,
        };
      },
      async markLatestReminderOpened() {
        const latest = db.reminders[db.reminders.length - 1];
        if (latest && !latest.opened_at) {
          latest.opened_at = new Date();
        }
      },
      async markLatestReminderClicked() {
        const latest = db.reminders[db.reminders.length - 1];
        if (latest && !latest.clicked_at) {
          latest.clicked_at = new Date();
        }
      },
      async reopenCart() {
        db.cart.status = 'open';
      },
      async attachRecoveredOrder(input) {
        if (!db.abandoned || db.abandoned.recovered_at) {
          return false;
        }
        db.abandoned.recovered_at = new Date();
        db.abandoned.recovered_order_id = input.orderId;
        return true;
      },
    };

    const sentEmails = [];
    const emailService = {
      async sendAbandonedCartRecovery(input) {
        sentEmails.push(input);
      },
    };

    const config = {
      get(key, fallback) {
        const values = {
          ABANDONED_CART_INACTIVITY_MINUTES: 60,
          ABANDONED_CART_CAPTURE_BATCH_SIZE: 200,
          ABANDONED_CART_REMINDER_COOLDOWN_HOURS: 24,
          ABANDONED_CART_REMINDER_BATCH_SIZE: 100,
          API_PUBLIC_BASE_URL: 'http://localhost:3000',
          STOREFRONT_BASE_URL: 'http://localhost:3001',
        };
        return key in values ? values[key] : fallback;
      },
    };

    const service = new AbandonedCartsService(repository, emailService, config);

    const capture = await service.captureAbandonedCarts();
    assert.equal(capture.scanned, 1);
    assert.equal(capture.captured, 1);
    assert.equal(db.cart.status, 'abandoned');

    const firstDispatch = await service.dispatchRecoveryEmails();
    assert.equal(firstDispatch.sent, 1);
    assert.equal(sentEmails.length, 1);
    assert.equal(db.reminders.length, 1);

    const secondDispatch = await service.dispatchRecoveryEmails();
    assert.equal(secondDispatch.sent, 0);
    assert.equal(sentEmails.length, 1);

    db.abandoned.recovery_sent_at = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const thirdDispatch = await service.dispatchRecoveryEmails();
    assert.equal(thirdDispatch.sent, 1);
    assert.equal(sentEmails.length, 2);
    assert.equal(db.reminders.length, 2);

    await service.trackRecoveryEmailOpen(token);
    assert.equal(db.reminders[1].opened_at instanceof Date, true);

    const redirect = await service.resolveRecoveryRedirect(token);
    assert.equal(redirect.cartId, cartId);
    assert.equal(redirect.redirectUrl.includes('/checkout?cartId='), true);
    assert.equal(db.reminders[1].clicked_at instanceof Date, true);
    assert.equal(db.cart.status, 'open');

    const attached = await service.attachRecoveredCheckout({
      storeId,
      cartId,
      orderId: randomUUID(),
    });
    assert.equal(attached, true);
    assert.equal(db.abandoned.recovered_order_id !== null, true);
  });

  it('rejects expired recovery token', async () => {
    const repository = {
      async findRecoveryTargetByToken() {
        return {
          abandoned_cart_id: randomUUID(),
          store_id: randomUUID(),
          store_slug: 'demo',
          cart_id: randomUUID(),
          recovery_token: 'expired-token',
          expires_at: new Date(Date.now() - 60_000),
          recovered_at: null,
        };
      },
      async markLatestReminderOpened() {
        return;
      },
      async markLatestReminderClicked() {
        return;
      },
      async reopenCart() {
        return;
      },
    };

    const service = new AbandonedCartsService(
      repository,
      { async sendAbandonedCartRecovery() {} },
      { get: (_key, fallback) => fallback },
    );

    await assert.rejects(
      () => service.resolveRecoveryRedirect('expired-token'),
      (error) =>
        error instanceof BadRequestException && error.message === 'Recovery link has expired',
    );
  });
});
