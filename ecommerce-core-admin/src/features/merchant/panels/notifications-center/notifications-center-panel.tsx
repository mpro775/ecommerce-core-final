import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  NotificationCategory,
  NotificationPreference,
  NotificationSeverity,
  NotificationsInboxResponse,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';

interface NotificationsCenterPanelProps {
  request: MerchantRequester;
  notificationRealtimeVersion?: number;
}

const CATEGORY_TABS: Array<{ value: NotificationCategory | 'all'; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'orders', label: 'الطلبات' },
  { value: 'payments', label: 'الدفع' },
  { value: 'inventory', label: 'المخزون' },
  { value: 'cart', label: 'السلات' },
  { value: 'support', label: 'الدعم' },
  { value: 'domain', label: 'الدومينات' },
  { value: 'theme', label: 'القوالب' },
  { value: 'system', label: 'النظام' },
];

const CATEGORY_LABELS: Record<string, string> = {
  orders: 'الطلبات',
  payments: 'الدفع',
  inventory: 'المخزون',
  cart: 'السلات',
  checkout: 'إتمام الطلب',
  support: 'الدعم',
  domain: 'الدومينات',
  theme: 'القوالب',
  analytics: 'التحليلات',
  system: 'النظام',
};

const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  info: 'معلومة',
  success: 'نجاح',
  warning: 'تنبيه',
  critical: 'حرج',
};

const SEVERITY_COLORS: Record<NotificationSeverity, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  critical: 'error',
};

const FREQUENCY_OPTIONS: Array<'instant' | 'daily_digest' | 'mute'> = [
  'instant',
  'daily_digest',
  'mute',
];

const FREQUENCY_LABELS: Record<'instant' | 'daily_digest' | 'mute', string> = {
  instant: 'فوري',
  daily_digest: 'ملخص يومي',
  mute: 'إيقاف',
};

const PERIOD_OPTIONS = [
  { value: '', label: 'كل الفترات' },
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'آخر 7 أيام' },
  { value: 'month', label: 'آخر 30 يومًا' },
];

export function NotificationsCenterPanel({
  request,
  notificationRealtimeVersion = 0,
}: NotificationsCenterPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inbox, setInbox] = useState<NotificationsInboxResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<NotificationSeverity | ''>('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const dateRange = useMemo(() => buildDateRange(periodFilter), [periodFilter]);

  useEffect(() => {
    loadData().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notificationRealtimeVersion > 0) {
      loadData().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationRealtimeVersion]);

  async function loadData(): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        unreadOnly: unreadOnly ? 'true' : 'false',
      });
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (dateRange.dateFrom) params.set('dateFrom', dateRange.dateFrom);
      if (dateRange.dateTo) params.set('dateTo', dateRange.dateTo);

      const [inboxResponse, prefsResponse] = await Promise.all([
        request<NotificationsInboxResponse>(`/notifications/inbox?${params.toString()}`, { method: 'GET' }),
        request<NotificationPreference[]>('/notifications/preferences', { method: 'GET' }),
      ]);

      setInbox(inboxResponse ?? { items: [], total: 0, page: 1, limit: 20 });
      setPreferences(prefsResponse ?? []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تحميل مركز الإشعارات',
      });
    } finally {
      setLoading(false);
    }
  }

  async function markRead(notificationId: string): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await request(`/notifications/${notificationId}/read`, { method: 'PATCH' });
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تعليم الإشعار كمقروء',
      });
    } finally {
      setSaving(false);
    }
  }

  async function markAllRead(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await request('/notifications/read-all', { method: 'PATCH' });
      await loadData();
      setMessage({ type: 'success', text: 'تم تعليم كل الإشعارات كمقروءة.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تعليم كل الإشعارات كمقروءة',
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      await request('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          preferences: preferences.map((item) => ({
            eventType: item.eventType,
            channel: item.channel,
            isEnabled: item.isEnabled,
            frequency: item.frequency,
            target: item.recipientType === 'store_user' ? 'store_user' : 'store',
          })),
        }),
      });
      setMessage({ type: 'success', text: 'تم حفظ التفضيلات.' });
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر حفظ التفضيلات',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage maxWidth={1300}>
      <PageHeader
        title="مركز الإشعارات"
        description="إدارة تنبيهات المتجر حسب التصنيف والأهمية وتفضيلات الإرسال."
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={() => loadData().catch(() => undefined)} disabled={loading || saving}>
              تحديث
            </Button>
            <Button variant="outlined" onClick={() => markAllRead().catch(() => undefined)} disabled={saving}>
              تعليم الكل كمقروء
            </Button>
          </Stack>
        }
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <DataTableWrapper>
        <Tabs
          value={categoryFilter}
          onChange={(_, value: NotificationCategory | 'all') => setCategoryFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {CATEGORY_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>

        <FilterBar>
          <FormControlLabel
            control={<Switch checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />}
            label="غير مقروء فقط"
          />
          <TextField
            select
            label="الأهمية"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as NotificationSeverity | '')}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">كل المستويات</MenuItem>
            {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="الفترة"
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {PERIOD_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => loadData().catch(() => undefined)} disabled={loading}>
            تطبيق
          </Button>
        </FilterBar>

        <Stack spacing={1.4} sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
          ) : inbox.items.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              لا توجد إشعارات مطابقة.
            </Typography>
          ) : (
            inbox.items.map((item) => (
              <Box
                key={item.id}
                sx={{
                  border: '1px solid',
                  borderColor: item.status === 'unread' ? 'warning.light' : 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  bgcolor: item.status === 'unread' ? 'action.hover' : 'background.paper',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.8 }}>
                      <Chip size="small" label={SEVERITY_LABELS[item.severity]} color={SEVERITY_COLORS[item.severity]} />
                      <Chip size="small" label={CATEGORY_LABELS[item.category ?? 'system'] ?? item.category ?? 'النظام'} variant="outlined" />
                      <Chip size="small" label={item.status === 'unread' ? 'غير مقروء' : 'مقروء'} color={item.status === 'unread' ? 'warning' : 'default'} />
                    </Stack>
                    <Typography fontWeight={800}>{item.title}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.4 }}>{item.body}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
                      {item.type} · {formatDate(item.createdAt)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    {item.actionUrl ? (
                      <Button size="small" variant="contained" href={item.actionUrl}>
                        فتح
                      </Button>
                    ) : null}
                    {item.status === 'unread' ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => markRead(item.id).catch(() => undefined)}
                        disabled={saving}
                      >
                        مقروء
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </DataTableWrapper>

      <Box sx={{ mt: 2 }}>
      <DataTableWrapper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
            تفضيلات الإشعارات
          </Typography>
          {preferences.length === 0 ? (
            <Typography color="text.secondary">لا توجد تفضيلات مهيأة بعد.</Typography>
          ) : (
            <Stack spacing={1.2}>
              {preferences.map((item, index) => (
                <Box key={`${item.eventType}:${item.channel}:${item.recipientType}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography fontWeight={800}>{item.eventType}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {CATEGORY_LABELS[item.category ?? 'system'] ?? item.category ?? 'النظام'} · {item.channel} · {item.recipientType}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={item.isEnabled}
                            onChange={(event) =>
                              setPreferences((prev) =>
                                prev.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, isEnabled: event.target.checked }
                                    : entry,
                                ),
                              )
                            }
                          />
                        }
                        label="مفعل"
                      />
                      <TextField
                        select
                        size="small"
                        value={item.frequency}
                        onChange={(event) =>
                          setPreferences((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    frequency: event.target.value as 'instant' | 'daily_digest' | 'mute',
                                  }
                                : entry,
                            ),
                          )
                        }
                        sx={{ minWidth: 150 }}
                      >
                        {FREQUENCY_OPTIONS.map((frequency) => (
                          <MenuItem key={frequency} value={frequency}>{FREQUENCY_LABELS[frequency]}</MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          <Button
            variant="contained"
            sx={{ mt: 1.5 }}
            onClick={() => savePreferences().catch(() => undefined)}
            disabled={saving}
          >
            حفظ التفضيلات
          </Button>
        </Box>
      </DataTableWrapper>
      </Box>
    </AppPage>
  );
}

function buildDateRange(period: string): { dateFrom?: string; dateTo?: string } {
  if (!period) return {};
  const now = new Date();
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    start.setDate(now.getDate() - 30);
  } else {
    return {};
  }
  return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
