import { AddIcon, CompareArrowsIcon, SyncIcon, WebhookIcon } from '../../../../components/icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { WebhookDelivery, WebhookEndpoint } from '../../types';
import { FloatingActionButton } from '../../components/ui';

interface WebhooksPanelProps {
  request: MerchantRequester;
}

const EVENT_OPTIONS = [
  'product.created',
  'product.updated',
  'order.created',
  'order.updated',
  'inventory.updated',
  'coupon.updated',
];

export function WebhooksPanel({ request }: WebhooksPanelProps) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });
  
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: ['order.created', 'order.updated'],
  });

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const [endpointRows, deliveryRows] = await Promise.all([
        request<WebhookEndpoint[]>('/webhooks', { method: 'GET' }),
        request<{ items: WebhookDelivery[] }>('/webhooks/deliveries?page=1&limit=10', {
          method: 'GET',
        }),
      ]);

      setEndpoints(endpointRows ?? []);
      setDeliveries(deliveryRows?.items ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل بيانات الويب هوكس', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function createEndpoint(): Promise<void> {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) {
      setMessage({ text: 'الاسم والرابط وحدث واحد على الأقل مطلوبة', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          events: form.events,
          isActive: true,
        }),
      });
      await loadAll();
      setMessage({ text: 'تم إنشاء نقطة نهاية ويب هوك بنجاح', type: 'success' });
      setForm((prev) => ({ ...prev, name: '', url: '' }));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء نقطة النهاية', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function triggerTestEvent(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request('/webhooks/test-event', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'order.updated',
          data: {
            source: 'admin-panel',
            triggeredAt: new Date().toISOString(),
          },
        }),
      });
      await loadAll();
      setMessage({ text: 'تم إرسال حدث اختباري بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تشغيل الحدث الاختباري', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function retryPending(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request('/webhooks/deliveries/retry-pending', { method: 'POST' });
      await loadAll();
      setMessage({ text: 'تمت معالجة الإعادات المعلقة', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر معالجة الإعادات المعلقة', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            الربط المتقدم (Webhooks)
          </Typography>
          <Typography color="text.secondary">
            أرسل الإشعارات الفورية للأنظمة الخارجية (مثل أنظمة المحاسبة) عند حدوث أي تغيير.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button 
            variant="outlined" 
            onClick={() => loadAll().catch(() => undefined)}
            disabled={loading}
          >
            تحديث القائمة
          </Button>
        </Stack>
      </Box>

      {message.text && (
        <Alert severity={message.type} sx={{ borderRadius: 2 }}>{message.text}</Alert>
      )}

      {/* Add Webhook Form */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <WebhookIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>إضافة نقطة نهاية جديدة (Endpoint)</Typography>
        </Box>
        <Divider sx={{ mb: 4 }} />
        
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
            <Box>
              <TextField 
                label="الاسم التعريفي" 
                fullWidth 
                value={form.name} 
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} 
                placeholder="مثال: نظام المحاسبة ERP"
                required
              />
            </Box>
            <Box>
              <TextField
                label="رابط الاستلام (URL)"
                fullWidth
                value={form.url}
                onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://example.com/api/webhooks"
                dir="ltr"
                required
              />
            </Box>
          </Box>

          <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>اختر الأحداث (Events) التي سيتم إرسالها:</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {EVENT_OPTIONS.map((eventType) => (
                <FormControlLabel
                  key={eventType}
                  control={
                    <Checkbox
                      checked={form.events.includes(eventType)}
                      onChange={(event) => {
                        setForm((prev) => ({
                          ...prev,
                          events: event.target.checked
                            ? [...prev.events, eventType]
                            : prev.events.filter((row) => row !== eventType),
                        }));
                      }}
                      color="primary"
                    />
                  }
                  label={<Typography variant="body2" fontFamily="monospace" dir="ltr">{eventType}</Typography>}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<AddIcon />}
              onClick={() => createEndpoint().catch(() => undefined)}
              disabled={actionLoading}
              sx={{ px: 4, borderRadius: 2 }}
            >
              {actionLoading ? 'جارِ الحفظ...' : 'إضافة Endpoint'}
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Lists */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
        
        {/* Endpoints Table */}
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: 'fit-content' }}>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrowsIcon color="action" />
            <Typography variant="subtitle1" fontWeight={800}>نقاط النهاية (Endpoints)</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الاسم / الرابط</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الأحداث المشتركة</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={2} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : endpoints.length === 0 ? (
                  <TableRow><TableCell colSpan={2} align="center" sx={{ py: 3 }}><Typography color="text.secondary">لا توجد نقاط نهاية مضافة.</Typography></TableCell></TableRow>
                ) : (
                  endpoints.map((endpoint) => (
                    <TableRow key={endpoint.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight={700}>{endpoint.name}</Typography>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace" dir="ltr" display="block">
                          {endpoint.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {endpoint.events.map(ev => (
                            <Chip key={ev} size="small" label={ev} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Deliveries Table */}
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: 'fit-content' }}>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SyncIcon color="action" />
              <Typography variant="subtitle1" fontWeight={800}>سجل الإرسال الحديث</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => triggerTestEvent().catch(() => undefined)} disabled={actionLoading}>إرسال تجريبي</Button>
              <Button size="small" variant="outlined" onClick={() => retryPending().catch(() => undefined)} disabled={actionLoading}>إعادة المعلق</Button>
            </Stack>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الحدث (Event)</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>حالة الاستجابة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>المحاولات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : deliveries.length === 0 ? (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}><Typography color="text.secondary">لا توجد عمليات إرسال مسجلة.</Typography></TableCell></TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <TableRow key={delivery.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" dir="ltr">{delivery.eventType}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          size="small" 
                          label={delivery.responseStatus ?? 'معلق'} 
                          color={delivery.responseStatus && delivery.responseStatus >= 200 && delivery.responseStatus < 300 ? 'success' : delivery.responseStatus ? 'error' : 'warning'} 
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{delivery.attemptNumber}</Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
      <FloatingActionButton
        label="إضافة Endpoint"
        icon={<AddIcon />}
        onClick={() => createEndpoint().catch(() => undefined)}
        disabled={actionLoading}
      />
    </Box>
  );
}
