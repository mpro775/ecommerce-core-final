import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/interfaces/access-token-payload.interface';
import type { CustomerAccessTokenPayload } from '../customers/interfaces/customer-user.interface';

type NotificationRecipientType = 'store' | 'store_user' | 'customer';

interface AuthenticatedSocketData {
  recipientType: NotificationRecipientType;
  storeId?: string;
  storeUserId?: string;
  customerId?: string;
}

export interface NotificationRealtimePayload {
  id: string;
  storeId: string | null;
  recipientType: NotificationRecipientType;
  recipientStoreUserId: string | null;
  recipientCustomerId: string | null;
  recipientLabel: string | null;
  type: string;
  category: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  source: string;
  dedupeKey: string | null;
  expiresAt: Date | string | null;
  title: string;
  body: string;
  status: 'unread' | 'read';
  readAt: Date | string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const auth = await this.authenticate(client);
      client.data.auth = auth;
      await this.joinRooms(client, auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized notification socket';
      this.logger.warn(`Socket rejected: ${message}`);
      client.emit('notifications.error', { message });
      client.disconnect(true);
    }
  }

  emitNotificationCreated(notification: NotificationRealtimePayload): void {
    for (const room of this.resolveNotificationRooms(notification)) {
      this.server?.to(room).emit('notification.created', notification);
    }
  }

  emitNotificationRead(input: {
    notificationId?: string;
    recipientType: NotificationRecipientType;
    storeId?: string;
    storeUserId?: string;
    customerId?: string;
  }): void {
    for (const room of this.resolveRecipientRooms(input)) {
      this.server?.to(room).emit('notification.read', {
        notificationId: input.notificationId ?? null,
      });
    }
  }

  emitUnreadCount(input: {
    count: number;
    recipientType: NotificationRecipientType;
    storeId?: string;
    storeUserId?: string;
    customerId?: string;
  }): void {
    for (const room of this.resolveRecipientRooms(input)) {
      this.server?.to(room).emit('notifications.unread_count', { count: input.count });
    }
  }

  private async authenticate(client: Socket): Promise<AuthenticatedSocketData> {
    const token = this.extractToken(client);
    if (!token) {
      throw new Error('Access token is required');
    }

    const merchant = await this.tryVerifyMerchantToken(token);
    if (merchant) {
      return {
        recipientType: 'store_user',
        storeId: merchant.storeId,
        storeUserId: merchant.sub,
      };
    }

    const customer = await this.tryVerifyCustomerToken(token);
    if (customer) {
      return {
        recipientType: 'customer',
        storeId: customer.storeId,
        customerId: customer.sub,
      };
    }

    throw new Error('Invalid or expired access token');
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }

    return null;
  }

  private async tryVerifyMerchantToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, { secret });
      if ('storeId' in payload && typeof payload.storeId === 'string') {
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async tryVerifyCustomerToken(token: string): Promise<CustomerAccessTokenPayload | null> {
    try {
      const secret = this.configService.getOrThrow<string>('JWT_CUSTOMER_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<CustomerAccessTokenPayload>(token, {
        secret,
      });
      if ('storeId' in payload && typeof payload.storeId === 'string') {
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async joinRooms(client: Socket, auth: AuthenticatedSocketData): Promise<void> {
    const rooms = this.resolveRecipientRooms(auth);
    await Promise.all(rooms.map((room) => client.join(room)));
  }

  private resolveNotificationRooms(notification: NotificationRealtimePayload): string[] {
    if (notification.recipientType === 'store' && notification.storeId) {
      return [`store:${notification.storeId}`];
    }
    if (notification.recipientType === 'store_user' && notification.recipientStoreUserId) {
      return [`store_user:${notification.recipientStoreUserId}`];
    }
    if (
      notification.recipientType === 'customer' &&
      notification.storeId &&
      notification.recipientCustomerId
    ) {
      return [`customer:${notification.storeId}:${notification.recipientCustomerId}`];
    }
    return [];
  }

  private resolveRecipientRooms(input: AuthenticatedSocketData): string[] {
    if (input.recipientType === 'store' && input.storeId) {
      return [`store:${input.storeId}`];
    }
    if (input.recipientType === 'store_user' && input.storeUserId) {
      const rooms = [`store_user:${input.storeUserId}`];
      if (input.storeId) {
        rooms.push(`store:${input.storeId}`);
      }
      return rooms;
    }
    if (input.recipientType === 'customer' && input.storeId && input.customerId) {
      return [`customer:${input.storeId}:${input.customerId}`];
    }
    return [];
  }
}
