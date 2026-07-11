import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  AffiliateCommissionsResponse,
  AffiliateLink,
  AffiliatePayoutBatch,
  AffiliateProfile,
  AffiliateSettings,
} from '../../types';

interface AffiliatesPanelProps {
  request: MerchantRequester;
}

export function AffiliatesPanel({ request }: AffiliatesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateProfile[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommissionsResponse | null>(null);
  const [payoutBatches, setPayoutBatches] = useState<AffiliatePayoutBatch[]>([]);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [selectedAffiliateLinks, setSelectedAffiliateLinks] = useState<AffiliateLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );

  const [settingsForm, setSettingsForm] = useState({
    enabled: false,
    defaultRatePercent: '10',
    attributionWindowDays: '30',
    minPayoutAmount: '5000',
  });
  const [affiliateForm, setAffiliateForm] = useState({
    name: '',
    email: '',
    phone: '',
    commissionRatePercent: '10',
  });
  const [linkForm, setLinkForm] = useState({
    code: '',
    targetPath: '/',
  });

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAffiliate = useMemo(
    () => affiliates.find((a) => a.id === selectedAffiliateId) ?? null,
    [affiliates, selectedAffiliateId],
  );

  async function loadAll(): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const [settingsData, affiliatesData, commissionsData, payoutData] = await Promise.all([
        request<AffiliateSettings>('/affiliates/settings', { method: 'GET' }),
        request<AffiliateProfile[]>('/affiliates', { method: 'GET' }),
        request<AffiliateCommissionsResponse>('/affiliates/commissions?page=1&limit=20', {
          method: 'GET',
        }),
        request<AffiliatePayoutBatch[]>('/affiliates/payout-batches', { method: 'GET' }),
      ]);

      if (settingsData) {
        setSettings(settingsData);
        setSettingsForm({
          enabled: settingsData.enabled,
          defaultRatePercent: String(settingsData.defaultRatePercent),
          attributionWindowDays: String(settingsData.attributionWindowDays),
          minPayoutAmount: String(settingsData.minPayoutAmount),
        });
      }
      setAffiliates(affiliatesData ?? []);
      setCommissions(commissionsData);
      setPayoutBatches(payoutData ?? []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تحميل بيانات التسويق بالعمولة',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadLinks(affiliateId: string): Promise<void> {
    setSelectedAffiliateId(affiliateId);
    try {
      const links = await request<AffiliateLink[]>(`/affiliates/${affiliateId}/links`, { method: 'GET' });
      setSelectedAffiliateLinks(links ?? []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تحميل روابط المسوق',
      });
    }
  }

  async function saveSettings(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await request<AffiliateSettings>('/affiliates/settings', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: settingsForm.enabled,
          defaultRatePercent: Number(settingsForm.defaultRatePercent),
          attributionWindowDays: Number(settingsForm.attributionWindowDays),
          minPayoutAmount: Number(settingsForm.minPayoutAmount),
        }),
      });
      if (updated) {
        setSettings(updated);
      }
      setMessage({ type: 'success', text: 'تم تحديث إعدادات التسويق بالعمولة' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ الإعدادات' });
    } finally {
      setBusy(false);
    }
  }

  async function createAffiliate(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await request('/affiliates', {
        method: 'POST',
        body: JSON.stringify({
          name: affiliateForm.name,
          email: affiliateForm.email || undefined,
          phone: affiliateForm.phone || undefined,
          commissionRatePercent: Number(affiliateForm.commissionRatePercent),
        }),
      });
      setAffiliateForm({
        name: '',
        email: '',
        phone: '',
        commissionRatePercent: settings ? String(settings.defaultRatePercent) : '10',
      });
      await loadAll();
      setMessage({ type: 'success', text: 'تم إنشاء المسوق بنجاح' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر إنشاء المسوق',
      });
    } finally {
      setBusy(false);
    }
  }

  async function createLink(): Promise<void> {
    if (!selectedAffiliateId) {
      setMessage({ type: 'error', text: 'اختر مسوقاً أولاً' });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await request(`/affiliates/${selectedAffiliateId}/links`, {
        method: 'POST',
        body: JSON.stringify({
          code: linkForm.code,
          targetPath: linkForm.targetPath,
        }),
      });
      setLinkForm({ code: '', targetPath: '/' });
      await loadLinks(selectedAffiliateId);
      setMessage({ type: 'success', text: 'تم إنشاء الرابط بنجاح' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر إنشاء الرابط',
      });
    } finally {
      setBusy(false);
    }
  }

  async function createPayoutBatch(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await request('/affiliates/payout-batches', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadAll();
      setMessage({ type: 'success', text: 'تم إنشاء دفعة التسوية' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر إنشاء دفعة التسوية',
      });
    } finally {
      setBusy(false);
    }
  }

  async function markBatchPaid(batchId: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await request(`/affiliates/payout-batches/${batchId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadAll();
      setMessage({ type: 'success', text: 'تم تعليم الدفعة كمدفوعة' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تعليم الدفعة كمدفوعة',
      });
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv(): Promise<void> {
    try {
      const csv = await request<string>(
        '/affiliates/reports/export',
        { method: 'GET' },
        { responseType: 'text' },
      );
      if (!csv) {
        return;
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'affiliate-commissions.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      setMessage({ type: 'error', text: 'تعذر تنزيل التقرير' });
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 260 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          التسويق بالعمولة
        </Typography>
        <Typography color="text.secondary">
          إدارة المسوقين، الروابط، العمولات، ودفعات التسوية.
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          إعدادات البرنامج
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="الحالة"
            value={settingsForm.enabled ? 'enabled' : 'disabled'}
            onChange={(event) =>
              setSettingsForm((prev) => ({ ...prev, enabled: event.target.value === 'enabled' }))
            }
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="enabled">مفعل</MenuItem>
            <MenuItem value="disabled">متوقف</MenuItem>
          </TextField>
          <TextField
            label="نسبة العمولة الافتراضية (%)"
            type="number"
            value={settingsForm.defaultRatePercent}
            onChange={(event) =>
              setSettingsForm((prev) => ({ ...prev, defaultRatePercent: event.target.value }))
            }
          />
          <TextField
            label="نافذة الإسناد (أيام)"
            type="number"
            value={settingsForm.attributionWindowDays}
            onChange={(event) =>
              setSettingsForm((prev) => ({ ...prev, attributionWindowDays: event.target.value }))
            }
          />
          <TextField
            label="حد الصرف الأدنى"
            type="number"
            value={settingsForm.minPayoutAmount}
            onChange={(event) =>
              setSettingsForm((prev) => ({ ...prev, minPayoutAmount: event.target.value }))
            }
          />
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => saveSettings().catch(() => undefined)} disabled={busy}>
            حفظ الإعدادات
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          إضافة مسوق جديد
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="الاسم"
            value={affiliateForm.name}
            onChange={(event) => setAffiliateForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <TextField
            label="البريد الإلكتروني"
            value={affiliateForm.email}
            onChange={(event) => setAffiliateForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <TextField
            label="الهاتف"
            value={affiliateForm.phone}
            onChange={(event) => setAffiliateForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <TextField
            label="نسبة العمولة (%)"
            type="number"
            value={affiliateForm.commissionRatePercent}
            onChange={(event) =>
              setAffiliateForm((prev) => ({ ...prev, commissionRatePercent: event.target.value }))
            }
          />
          <Button variant="contained" onClick={() => createAffiliate().catch(() => undefined)} disabled={busy}>
            إنشاء
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          المسوقون
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {affiliates.map((affiliate) => (
            <Button
              key={affiliate.id}
              variant={selectedAffiliateId === affiliate.id ? 'contained' : 'outlined'}
              onClick={() => loadLinks(affiliate.id).catch(() => undefined)}
            >
              {affiliate.name}
            </Button>
          ))}
        </Stack>

        {selectedAffiliate && (
          <Box sx={{ mb: 2 }}>
            <Typography fontWeight={700}>روابط {selectedAffiliate.name}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1, mb: 2 }}>
              <TextField
                label="رمز الرابط"
                value={linkForm.code}
                onChange={(event) => setLinkForm((prev) => ({ ...prev, code: event.target.value }))}
              />
              <TextField
                label="المسار"
                value={linkForm.targetPath}
                onChange={(event) => setLinkForm((prev) => ({ ...prev, targetPath: event.target.value }))}
              />
              <Button variant="outlined" onClick={() => createLink().catch(() => undefined)} disabled={busy}>
                إضافة رابط
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {selectedAffiliateLinks.map((link) => (
                <Chip key={link.id} label={`${link.code} -> ${link.targetPath}`} />
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800}>
            العمولات
          </Typography>
          <Button onClick={() => exportCsv().catch(() => undefined)}>تصدير CSV</Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>الطلب</TableCell>
                <TableCell>المسوق</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العمولة</TableCell>
                <TableCell>الصافي</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(commissions?.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.orderCode}</TableCell>
                  <TableCell>{item.affiliateName}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.commissionAmount}</TableCell>
                  <TableCell>{item.netAmount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={800}>
            دفعات التسوية
          </Typography>
          <Button variant="contained" onClick={() => createPayoutBatch().catch(() => undefined)} disabled={busy}>
            إنشاء دفعة
          </Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1}>
          {payoutBatches.map((batch) => (
            <Stack
              key={batch.id}
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
              sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <Typography>
                {batch.id} - {batch.status} - {batch.totalAmount} {batch.currencyCode}
              </Typography>
              <Button
                size="small"
                disabled={busy || batch.status === 'paid'}
                onClick={() => markBatchPaid(batch.id).catch(() => undefined)}
              >
                تعليم كمدفوع
              </Button>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
