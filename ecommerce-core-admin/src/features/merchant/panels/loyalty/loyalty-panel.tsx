import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import type { LoyaltyLedgerEntry, LoyaltyRule, LoyaltySettings, LoyaltyWallet } from '../../types';
import { AppPage, PageHeader, SectionCard } from '../../components/ui';

interface LoyaltyPanelProps {
  request: MerchantRequester;
}

export function LoyaltyPanel({ request }: LoyaltyPanelProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [settings, setSettings] = useState<LoyaltySettings>({
    isEnabled: false,
    redeemRatePoints: 100,
    redeemRateAmount: 1,
    minRedeemPoints: 100,
    redeemStepPoints: 10,
    maxDiscountPercent: 50,
  });
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>([]);

  const [adjustCustomerId, setAdjustCustomerId] = useState('');
  const [adjustPointsDelta, setAdjustPointsDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [customerWallet, setCustomerWallet] = useState<LoyaltyWallet | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(): Promise<void> {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [settingsData, rulesData, ledgerData] = await Promise.all([
        request<LoyaltySettings>('/loyalty/settings', { method: 'GET' }),
        request<LoyaltyRule[]>('/loyalty/rules', { method: 'GET' }),
        request<LoyaltyLedgerEntry[]>('/loyalty/ledger', { method: 'GET' }),
      ]);
      if (settingsData) setSettings(settingsData);
      setRules(rulesData ?? []);
      setLedger(ledgerData ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل بيانات الولاء');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(): Promise<void> {
    setError('');
    setMessage('');
    try {
      await request('/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setMessage('تم حفظ إعدادات الولاء');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر حفظ الإعدادات');
    }
  }

  async function saveRules(): Promise<void> {
    setError('');
    setMessage('');
    try {
      await request('/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({
          rules: rules.map((rule, index) => ({
            name: rule.name,
            ruleType: rule.ruleType,
            earnRate: rule.earnRate,
            minOrderAmount: rule.minOrderAmount,
            isActive: rule.isActive,
            priority: rule.priority || (index + 1) * 100,
          })),
        }),
      });
      setMessage('تم حفظ قواعد الكسب');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر حفظ القواعد');
    }
  }

  async function loadCustomerWallet(): Promise<void> {
    if (!adjustCustomerId.trim()) return;
    setError('');
    setMessage('');
    try {
      const wallet = await request<LoyaltyWallet>(
        `/loyalty/customers/${encodeURIComponent(adjustCustomerId.trim())}/wallet`,
        { method: 'GET' },
      );
      setCustomerWallet(wallet);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل محفظة العميل');
    }
  }

  async function createAdjustment(): Promise<void> {
    if (!adjustCustomerId.trim() || !adjustPointsDelta.trim()) {
      setError('أدخل معرف العميل وعدد النقاط');
      return;
    }

    setError('');
    setMessage('');
    try {
      await request(
        `/loyalty/customers/${encodeURIComponent(adjustCustomerId.trim())}/adjustments`,
        {
          method: 'POST',
          body: JSON.stringify({
            pointsDelta: Number(adjustPointsDelta),
            reason: adjustReason.trim() || undefined,
          }),
        },
      );
      setMessage('تم إنشاء التعديل بنجاح');
      setAdjustPointsDelta('');
      setAdjustReason('');
      await Promise.all([loadCustomerWallet(), loadData()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تنفيذ التعديل');
    }
  }

  const fallbackRules: LoyaltyRule[] = [
    {
      id: 'new',
      name: 'Default earn rule',
      ruleType: 'order_percent',
      earnRate: 1,
      minOrderAmount: 0,
      isActive: true,
      priority: 100,
    },
  ];
  const visibleRules = rules.length > 0 ? rules : fallbackRules;

  return (
    <AppPage maxWidth={1200}>
      <PageHeader
        title="برنامج الولاء"
        description="إدارة إعدادات النقاط، قواعد الكسب، وسجل الحركات."
        actions={
          <Button variant="outlined" onClick={() => void loadData()} disabled={loading}>
            تحديث
          </Button>
        }
      />

      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <SectionCard title="إعدادات البرنامج" description="التحكم في الصرف والتحويل وحدود الخصم.">
        <Box
          sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' } }}
        >
          <TextField
            select
            label="تفعيل البرنامج"
            value={settings.isEnabled ? 'enabled' : 'disabled'}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, isEnabled: event.target.value === 'enabled' }))
            }
          >
            <MenuItem value="enabled">مفعل</MenuItem>
            <MenuItem value="disabled">غير مفعل</MenuItem>
          </TextField>
          <TextField
            type="number"
            label="نقاط التحويل"
            value={settings.redeemRatePoints}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                redeemRatePoints: Number(event.target.value || 0),
              }))
            }
          />
          <TextField
            type="number"
            label="قيمة التحويل النقدية"
            value={settings.redeemRateAmount}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                redeemRateAmount: Number(event.target.value || 0),
              }))
            }
          />
          <TextField
            type="number"
            label="أدنى نقاط للصرف"
            value={settings.minRedeemPoints}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, minRedeemPoints: Number(event.target.value || 0) }))
            }
          />
          <TextField
            type="number"
            label="خطوة الصرف"
            value={settings.redeemStepPoints}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                redeemStepPoints: Number(event.target.value || 0),
              }))
            }
          />
          <TextField
            type="number"
            label="أقصى خصم %"
            value={settings.maxDiscountPercent}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                maxDiscountPercent: Number(event.target.value || 0),
              }))
            }
          />
        </Box>
        <Stack direction="row" sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => void saveSettings()}>
            حفظ الإعدادات
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard title="قواعد الكسب" description="قاعدة افتراضية لحساب النقاط على قيمة الطلب.">
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr' },
          }}
        >
          {visibleRules.map((rule, idx) => (
            <Paper key={rule.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <TextField
                  label="اسم القاعدة"
                  value={rule.name}
                  onChange={(event) => {
                    setRules((prev) => {
                      const next = [...(prev.length ? prev : [rule])];
                      const currentRule = next[idx] ?? rule;
                      next[idx] = { ...currentRule, name: event.target.value };
                      return next;
                    });
                  }}
                />
                <TextField
                  type="number"
                  label="نسبة الكسب %"
                  value={rule.earnRate}
                  onChange={(event) => {
                    setRules((prev) => {
                      const next = [...(prev.length ? prev : [rule])];
                      const currentRule = next[idx] ?? rule;
                      next[idx] = { ...currentRule, earnRate: Number(event.target.value || 0) };
                      return next;
                    });
                  }}
                />
                <TextField
                  type="number"
                  label="أدنى طلب"
                  value={rule.minOrderAmount}
                  onChange={(event) => {
                    setRules((prev) => {
                      const next = [...(prev.length ? prev : [rule])];
                      const currentRule = next[idx] ?? rule;
                      next[idx] = {
                        ...currentRule,
                        minOrderAmount: Number(event.target.value || 0),
                      };
                      return next;
                    });
                  }}
                />
              </Stack>
            </Paper>
          ))}
        </Box>
        <Stack direction="row" sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => void saveRules()}>
            حفظ القواعد
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard title="تعديل يدوي" description="تعديل نقاط عميل مع سبب اختياري.">
        <Box
          sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}
        >
          <TextField
            label="معرف العميل"
            value={adjustCustomerId}
            onChange={(event) => setAdjustCustomerId(event.target.value)}
          />
          <TextField
            label="التغير بالنقاط (+/-)"
            type="number"
            value={adjustPointsDelta}
            onChange={(event) => setAdjustPointsDelta(event.target.value)}
          />
          <TextField
            label="السبب"
            value={adjustReason}
            onChange={(event) => setAdjustReason(event.target.value)}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => void loadCustomerWallet()}>
            جلب المحفظة
          </Button>
          <Button variant="contained" onClick={() => void createAdjustment()}>
            تنفيذ التعديل
          </Button>
        </Stack>
        {customerWallet ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
            <Alert severity="info">الرصيد المتاح: {customerWallet.availablePoints}</Alert>
            <Alert severity="info">المكتسب: {customerWallet.lifetimeEarnedPoints}</Alert>
            <Alert severity="info">المصروف: {customerWallet.lifetimeRedeemedPoints}</Alert>
          </Stack>
        ) : null}
      </SectionCard>

      <SectionCard title="سجل الحركات" description="آخر 500 حركة نقاط على المتجر.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>التاريخ</TableCell>
                <TableCell>النوع</TableCell>
                <TableCell>العميل</TableCell>
                <TableCell>النقاط</TableCell>
                <TableCell>الرصيد بعد الحركة</TableCell>
                <TableCell>السبب</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">لا توجد حركات بعد</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.createdAt).toLocaleString('ar-EG')}</TableCell>
                    <TableCell>{entry.entryType}</TableCell>
                    <TableCell>{entry.customerId}</TableCell>
                    <TableCell>{entry.pointsDelta}</TableCell>
                    <TableCell>{entry.balanceAfter}</TableCell>
                    <TableCell>{entry.reason || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
    </AppPage>
  );
}
