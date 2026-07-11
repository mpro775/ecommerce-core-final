import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
  Divider,
  Popover,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  NotificationInboxItem,
  NotificationsInboxResponse,
} from '../../types';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface MerchantNotificationsMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onViewAll: () => void;
  request: MerchantRequester;
  realtimeVersion: number;
}

export function MerchantNotificationsMenu({
  anchorEl,
  onClose,
  onViewAll,
  request,
  realtimeVersion,
}: MerchantNotificationsMenuProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const radius = ADMIN_TOKENS.radius;
  const [notifications, setNotifications] = useState<NotificationInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request<NotificationsInboxResponse>(
        '/notifications/inbox?page=1&limit=5',
        { method: 'GET' },
      );
      setNotifications(response?.items ?? []);
    } catch {
      // silently handle fetch failure
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (open && realtimeVersion > 0) {
      fetchNotifications();
    }
  }, [realtimeVersion, open, fetchNotifications]);

  async function handleNotificationClick(notification: NotificationInboxItem) {
    onClose();
    if (notification.status === 'unread') {
      try {
        await request(`/notifications/${notification.id}/read`, { method: 'PATCH' });
        fetchNotifications();
      } catch {
        // silently handle
      }
    }
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank', 'noreferrer');
    } else {
      onViewAll();
    }
  }

  function handleViewAll() {
    onClose();
    onViewAll();
  }

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      disableAutoFocus
      disableEnforceFocus
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            mt: 1,
            width: { xs: `calc(100vw - 32px)`, sm: 380 },
            maxHeight: 480,
            borderRadius: `${radius.lg}px`,
            border: '1px solid',
            borderColor: isDark
              ? alpha(theme.palette.common.white, 0.12)
              : alpha(theme.palette.divider, 0.9),
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.98),
            backdropFilter: 'blur(16px)',
            boxShadow: isDark
              ? '0 20px 42px rgba(9, 7, 16, 0.28)'
              : '0 18px 36px rgba(15, 23, 42, 0.12)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1.5 }}
      >
        <Typography fontWeight={800} fontSize="0.95rem">
          الإشعارات
        </Typography>
      </Stack>

      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
        {loading && notifications.length === 0 ? (
          <Stack spacing={1.2} sx={{ p: 2 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Stack key={i} direction="row" spacing={1.5} alignItems="center">
                <Skeleton variant="circular" width={8} height={8} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="80%" height={20} />
                  <Skeleton variant="text" width="55%" height={16} />
                </Box>
              </Stack>
            ))}
          </Stack>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
            <Typography color="text.secondary" fontSize="0.875rem">
              لا توجد إشعارات حاليًا
            </Typography>
          </Box>
        ) : (
          notifications.map((notification) => (
            <NotificationMenuItem
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
            />
          ))
        )}
      </Box>

      <Divider />

      <Box sx={{ p: 1 }}>
        <Button
          fullWidth
          size="small"
          onClick={handleViewAll}
          sx={{
            fontWeight: 800,
            textTransform: 'none',
            borderRadius: `${radius.md}px`,
          }}
        >
          عرض كل الإشعارات
        </Button>
      </Box>
    </Popover>
  );
}

function NotificationMenuItem({
  notification,
  onClick,
}: {
  notification: NotificationInboxItem;
  onClick: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isUnread = notification.status === 'unread';

  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.25,
        cursor: 'pointer',
        bgcolor: isUnread
          ? alpha(theme.palette.primary.main, isDark ? 0.08 : 0.05)
          : 'transparent',
        '&:hover': {
          bgcolor: isDark
            ? alpha(theme.palette.common.white, 0.06)
            : alpha(theme.palette.primary.main, 0.04),
        },
        transition: 'background-color 120ms ease',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: isUnread ? 'primary.main' : 'transparent',
            mt: '6px',
            flexShrink: 0,
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            fontWeight={isUnread ? 800 : 600}
            noWrap
            sx={{ lineHeight: 1.3 }}
          >
            {notification.title}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: 'block', lineHeight: 1.4 }}
          >
            {notification.body}
          </Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', mt: 0.3 }}
          >
            {formatRelativeTime(notification.createdAt)}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  if (diffDay < 7) return `منذ ${diffDay} يوم`;

  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
