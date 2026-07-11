import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { MerchantSession } from '../types';

interface UnreadCountResponse {
  count: number;
}

export function useMerchantNotificationsRealtime(
  session: MerchantSession,
  request: MerchantRequester,
  onNotificationCreated?: (payload: unknown) => void,
) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [version, setVersion] = useState(0);
  const onNotificationCreatedRef = useRef(onNotificationCreated);

  useEffect(() => {
    onNotificationCreatedRef.current = onNotificationCreated;
  }, [onNotificationCreated]);

  const refreshUnreadCount = useCallback(async () => {
    const response = await request<UnreadCountResponse>('/notifications/unread-count', {
      method: 'GET',
    });
    setUnreadCount(response?.count ?? 0);
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    refreshUnreadCount().catch(() => undefined);

    socket = io(`${session.apiBaseUrl}/notifications`, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      if (!cancelled) {
        refreshUnreadCount().catch(() => undefined);
        setVersion((current) => current + 1);
      }
    });

    socket.on('notification.created', (payload: unknown) => {
      if (!cancelled) {
        setVersion((current) => current + 1);
        refreshUnreadCount().catch(() => undefined);
        onNotificationCreatedRef.current?.(payload);
      }
    });

    socket.on('notification.read', () => {
      if (!cancelled) {
        setVersion((current) => current + 1);
        refreshUnreadCount().catch(() => undefined);
      }
    });

    socket.on('notifications.unread_count', (payload: UnreadCountResponse) => {
      if (!cancelled && typeof payload?.count === 'number') {
        setUnreadCount(payload.count);
      }
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [refreshUnreadCount, session.accessToken, session.apiBaseUrl]);

  return { unreadCount, notificationRealtimeVersion: version, refreshUnreadCount };
}
