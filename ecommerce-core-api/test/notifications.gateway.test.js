const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { NotificationsGateway } = require('../dist/notifications/notifications.gateway');

describe('notifications.gateway realtime routing', () => {
  it('joins merchant sockets to store and store-user rooms', async () => {
    const gateway = createGateway();
    const socket = createSocket('merchant-token');

    await gateway.handleConnection(socket);

    assert.deepEqual(socket.joinedRooms.sort(), ['store:store-1', 'store_user:user-1']);
    assert.equal(socket.disconnected, false);
  });

  it('joins customer sockets to customer room', async () => {
    const gateway = createGateway();
    const socket = createSocket('customer-token');

    await gateway.handleConnection(socket);

    assert.deepEqual(socket.joinedRooms, ['customer:store-1:customer-1']);
    assert.equal(socket.disconnected, false);
  });

  it('joins platform sockets to platform rooms after live-session check', async () => {
    const gateway = createGateway();
    const socket = createSocket('platform-token');

    await gateway.handleConnection(socket);

    assert.deepEqual(socket.joinedRooms.sort(), ['platform', 'platform_user:admin-1']);
    assert.equal(socket.disconnected, false);
  });

  it('rejects invalid sockets', async () => {
    const gateway = createGateway();
    const socket = createSocket('bad-token');

    await gateway.handleConnection(socket);

    assert.equal(socket.disconnected, true);
    assert.equal(socket.emitted[0].event, 'notifications.error');
  });

  it('broadcasts created notifications to recipient room only', () => {
    const gateway = createGateway();
    const server = createServer();
    gateway.server = server;

    gateway.emitNotificationCreated({
      id: 'notification-1',
      storeId: 'store-1',
      recipientType: 'customer',
      recipientStoreUserId: null,
      recipientCustomerId: 'customer-1',
      recipientLabel: null,
      type: 'order.status.changed',
      title: 'Order updated',
      body: 'Order moved',
      status: 'unread',
      readAt: null,
      actionUrl: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert.deepEqual(server.calls, [
      {
        room: 'customer:store-1:customer-1',
        event: 'notification.created',
        payloadId: 'notification-1',
      },
    ]);
  });
});

function createGateway() {
  const jwtService = {
    async verifyAsync(token, options) {
      if (token === 'merchant-token' && options.secret === 'merchant-secret') {
        return {
          sub: 'user-1',
          sid: 'session-1',
          storeId: 'store-1',
          email: 'merchant@example.com',
          fullName: 'Merchant',
          role: 'owner',
          permissions: [],
        };
      }
      if (token === 'customer-token' && options.secret === 'customer-secret') {
        return {
          sub: 'customer-1',
          sid: 'customer-session-1',
          storeId: 'store-1',
          phone: '700000000',
          email: null,
          fullName: 'Customer',
        };
      }
      if (token === 'platform-token' && options.secret === 'merchant-secret') {
        return {
          sub: 'admin-1',
          sid: 'platform-session-1',
          email: 'admin@example.com',
          fullName: 'Admin',
          mfaEnabled: false,
          permissions: [],
          roleCodes: ['super_admin'],
          kind: 'platform_admin',
        };
      }
      throw new Error('invalid token');
    },
  };

  const configService = {
    getOrThrow(key) {
      if (key === 'JWT_ACCESS_SECRET') return 'merchant-secret';
      if (key === 'JWT_CUSTOMER_ACCESS_SECRET') return 'customer-secret';
      throw new Error(`Missing config ${key}`);
    },
  };

  const platformAuthRepository = {
    async findSessionById(id) {
      if (id !== 'platform-session-1') return null;
      return {
        admin_user_id: 'admin-1',
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000),
      };
    },
    async findAdminById(id) {
      if (id !== 'admin-1') return null;
      return { status: 'active' };
    },
  };

  return new NotificationsGateway(jwtService, configService, platformAuthRepository);
}

function createSocket(token) {
  return {
    handshake: {
      auth: { token },
      headers: {},
    },
    data: {},
    joinedRooms: [],
    emitted: [],
    disconnected: false,
    async join(room) {
      this.joinedRooms.push(room);
    },
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
    disconnect() {
      this.disconnected = true;
    },
  };
}

function createServer() {
  return {
    calls: [],
    to(room) {
      return {
        emit: (event, payload) => {
          this.calls.push({ room, event, payloadId: payload.id });
        },
      };
    },
  };
}
