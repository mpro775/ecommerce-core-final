import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import { AppPage, DataTableWrapper, PageHeader, SectionCard } from '../../components/ui';
import type {
  PaymentStatus,
  PaymentWithOrder,
  PlatformPaymentMethod,
  StorePaymentMethod,
} from '../../types';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface PaymentsPanelProps {
  request: MerchantRequester;
}

const statusLabels: Record<PaymentStatus, string> = {
  pending: 'قيد الانتظار',
  under_review: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  refunded: 'مسترجع',
};

const statusColors: Record<PaymentStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'error',
  refunded: 'default',
};

export function PaymentsPanel({ request }: PaymentsPanelProps) {
  const [section, setSection] = useState<'review' | 'settings'>('review');
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [payments, setPayments] = useState<PaymentWithOrder[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithOrder | null>(null);
  const [availableMethods, setAvailableMethods] = useState<PlatformPaymentMethod[]>([]);
  const [storeMethods, setStoreMethods] = useState<StorePaymentMethod[]>([]);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentWithOrder | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [methodFieldErrors, setMethodFieldErrors] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({
    text: '',
    type: 'info',
  });

  useEffect(() => {
    if (section === 'settings') {
      loadPaymentSettings().catch(() => undefined);
    } else if (activeTab === 'pending') {
      loadPendingPayments().catch(() => undefined);
    } else {
      loadAllPayments().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activeTab]);

  async function loadPendingPayments(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<PaymentWithOrder[]>('/payments/pending-review', { method: 'GET' });
      setPayments(data ?? []);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر تحميل المدفوعات', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadAllPayments(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<PaymentWithOrder[]>('/payments', { method: 'GET' });
      setPayments(data ?? []);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر تحميل المدفوعات', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadPaymentSettings(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [available, configured] = await Promise.all([
        request<PlatformPaymentMethod[]>('/merchant/payment-methods/available', { method: 'GET' }),
        request<StorePaymentMethod[]>('/merchant/payment-methods', { method: 'GET' }),
      ]);
      setAvailableMethods(available ?? []);
      setStoreMethods(configured ?? []);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر تحميل إعدادات الدفع', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function enablePlatformMethod(platformMethodId: string): Promise<void> {
    setActionLoading(true);
    try {
      await request(`/merchant/payment-methods/${platformMethodId}/enable`, { method: 'POST' });
      await loadPaymentSettings();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر إضافة طريقة الدفع', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveStoreMethod(method: StorePaymentMethod, patch: Partial<StorePaymentMethod>): Promise<void> {
    setActionLoading(true);
    setMethodFieldErrors((current) => ({ ...current, [method.id]: {} }));
    try {
      await request(`/merchant/payment-methods/${method.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isEnabled: patch.isEnabled ?? method.isEnabled,
          accountName: patch.accountName ?? method.accountName ?? undefined,
          accountNumber: patch.accountNumber ?? method.accountNumber ?? undefined,
          phoneNumber: patch.phoneNumber ?? method.phoneNumber ?? undefined,
          iban: patch.iban ?? method.iban ?? undefined,
          instructionsAr: patch.instructionsAr ?? method.instructionsAr ?? undefined,
          instructionsEn: patch.instructionsEn ?? method.instructionsEn ?? undefined,
          sortOrder: patch.sortOrder ?? method.sortOrder,
        }),
      });
      await loadPaymentSettings();
      setMessage({ text: 'تم حفظ إعدادات الدفع', type: 'success' });
    } catch (err) {
      if (isApiError(err)) {
        setMethodFieldErrors((current) => ({
          ...current,
          [method.id]: mapPaymentMethodFieldErrors(err.fieldErrors),
        }));
      }
      setMessage({ text: err instanceof Error ? err.message : 'تعذر حفظ إعدادات الدفع', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function reviewPayment(payment: PaymentWithOrder, status: 'approved' | 'rejected', note?: string): Promise<void> {
    setActionLoading(true);
    try {
      await request(`/payments/${payment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewNote: note?.trim() || undefined }),
      });
      setSelectedPayment(null);
      setRejectingPayment(null);
      setReviewNote('');
      await (activeTab === 'pending' ? loadPendingPayments() : loadAllPayments());
      setMessage({ text: status === 'approved' ? 'تم اعتماد الدفع' : 'تم رفض الدفع', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر تحديث الدفع', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function markCollected(payment: PaymentWithOrder): Promise<void> {
    setActionLoading(true);
    try {
      await request(`/payments/${payment.id}/mark-collected`, { method: 'PATCH' });
      setSelectedPayment(null);
      await loadAllPayments();
      setMessage({ text: 'تم تسجيل تحصيل مبلغ الدفع عند الاستلام', type: 'success' });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر تسجيل التحصيل', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppPage>
      <Stack direction="row" spacing={1}>
        <Button variant={section === 'review' ? 'contained' : 'outlined'} onClick={() => setSection('review')}>
          مراجعة المدفوعات
        </Button>
        <Button variant={section === 'settings' ? 'contained' : 'outlined'} onClick={() => setSection('settings')}>
          إعدادات طرق الدفع
        </Button>
      </Stack>

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      {section === 'settings' ? (
        <PaymentMethodSettings
          loading={loading}
          actionLoading={actionLoading}
          availableMethods={availableMethods}
          storeMethods={storeMethods}
          fieldErrorsByMethodId={methodFieldErrors}
          onClearFieldError={(methodId, fields) =>
            setMethodFieldErrors((current) => ({
              ...current,
              [methodId]: clearFieldErrors(current[methodId] ?? {}, fields),
            }))
          }
          onEnable={(id) => enablePlatformMethod(id)}
          onSave={(method, patch) => saveStoreMethod(method, patch)}
        />
      ) : selectedPayment ? (
        <PaymentDetail
          payment={selectedPayment}
          actionLoading={actionLoading}
          onBack={() => setSelectedPayment(null)}
          onApprove={() => reviewPayment(selectedPayment, 'approved')}
          onReject={() => setRejectingPayment(selectedPayment)}
          onMarkCollected={() => markCollected(selectedPayment)}
        />
      ) : (
        <Stack spacing={2}>
          <PageHeader
            title="المدفوعات والحوالات"
            description="مراجعة أرقام المراجع والإيصالات واعتماد المدفوعات اليدوية."
            actions={
              <Button
                variant="outlined"
                onClick={() => (activeTab === 'pending' ? loadPendingPayments() : loadAllPayments()).catch(() => undefined)}
                disabled={loading}
              >
                تحديث
              </Button>
            }
          />

          <Stack direction="row" spacing={1}>
            <Button variant={activeTab === 'pending' ? 'contained' : 'text'} onClick={() => setActiveTab('pending')}>
              قيد المراجعة
            </Button>
            <Button variant={activeTab === 'all' ? 'contained' : 'text'} onClick={() => setActiveTab('all')}>
              كل المدفوعات
            </Button>
          </Stack>

          <DataTableWrapper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>رقم الطلب</TableCell>
                    <TableCell>طريقة الدفع</TableCell>
                    <TableCell>رقم المرجع</TableCell>
                    <TableCell>المبلغ</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>الإيصال</TableCell>
                    <TableCell>تاريخ الإرسال</TableCell>
                    <TableCell align="left">إجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell>
                    </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>لا توجد مدفوعات</TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>{payment.orderCode}</TableCell>
                        <TableCell>{payment.paymentMethodName ?? payment.paymentMethodCode ?? payment.method}</TableCell>
                        <TableCell>{payment.payerReference ?? '-'}</TableCell>
                        <TableCell>{payment.amount.toFixed(2)}</TableCell>
                        <TableCell><Chip size="small" color={statusColors[payment.status]} label={statusLabels[payment.status]} /></TableCell>
                        <TableCell>
                          {payment.payerReceiptUrl ?? payment.receiptUrl ? (
                            <Button size="small" href={payment.payerReceiptUrl ?? payment.receiptUrl ?? '#'} target="_blank">عرض</Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{payment.customerSubmittedAt ? new Date(payment.customerSubmittedAt).toLocaleString('ar') : '-'}</TableCell>
                        <TableCell align="left">
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => setSelectedPayment(payment)}>عرض الطلب</Button>
                            {payment.status === 'under_review' ? (
                              <>
                                <Button size="small" color="success" variant="outlined" onClick={() => reviewPayment(payment, 'approved').catch(() => undefined)}>اعتماد</Button>
                                <Button size="small" color="error" variant="outlined" onClick={() => setRejectingPayment(payment)}>رفض</Button>
                              </>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DataTableWrapper>
        </Stack>
      )}

      <Dialog open={Boolean(rejectingPayment)} onClose={() => setRejectingPayment(null)} fullWidth maxWidth="sm">
        <DialogTitle>سبب رفض الدفع</DialogTitle>
        <DialogContent>
          <TextField
            label="ملاحظة المراجعة"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            multiline
            rows={4}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectingPayment(null)}>إلغاء</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!reviewNote.trim() || actionLoading}
            onClick={() => rejectingPayment && reviewPayment(rejectingPayment, 'rejected', reviewNote).catch(() => undefined)}
          >
            رفض الدفع
          </Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}

function PaymentDetail({
  payment,
  actionLoading,
  onBack,
  onApprove,
  onReject,
  onMarkCollected,
}: {
  payment: PaymentWithOrder;
  actionLoading: boolean;
  onBack: () => void;
  onApprove: () => Promise<void>;
  onReject: () => void;
  onMarkCollected: () => Promise<void>;
}) {
  const isCod = (payment.paymentMethodCode ?? payment.method) === 'cod';
  return (
    <Stack spacing={2}>
      <Button variant="outlined" onClick={onBack} sx={{ alignSelf: 'flex-start' }}>العودة</Button>
      <SectionCard>
        <Typography variant="h6" fontWeight={800} gutterBottom>بيانات الدفع</Typography>
        <Stack spacing={1.25}>
          <InfoRow label="رقم الطلب" value={payment.orderCode} />
          <InfoRow label="طريقة الدفع" value={payment.paymentMethodName ?? payment.paymentMethodCode ?? payment.method} />
          <InfoRow label="حالة الدفع" value={statusLabels[payment.status]} />
          <InfoRow label="المبلغ" value={payment.amount.toFixed(2)} />
          <InfoRow label="اسم الحساب المستلم" value={payment.accountName} />
          <InfoRow label="رقم الحساب المستلم" value={payment.accountNumber} />
          <InfoRow label="رقم الهاتف" value={payment.phoneNumber} />
          <InfoRow label="رقم مرجع العملية" value={payment.payerReference} />
          <InfoRow label="تعليمات الدفع" value={payment.instructionsAr ?? payment.instructionsEn} />
          <InfoRow label="تاريخ إرسال بيانات الدفع" value={payment.customerSubmittedAt ? new Date(payment.customerSubmittedAt).toLocaleString('ar') : null} />
          <InfoRow label="تمت المراجعة بواسطة" value={payment.reviewedBy} />
          <InfoRow label="ملاحظة المراجعة" value={payment.reviewNote} />
          {payment.payerReceiptUrl ?? payment.receiptUrl ? (
            <Button href={payment.payerReceiptUrl ?? payment.receiptUrl ?? '#'} target="_blank" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
              عرض صورة الإيصال
            </Button>
          ) : null}
        </Stack>
      </SectionCard>
      <Stack direction="row" spacing={1}>
        {payment.status === 'under_review' ? (
          <>
            <Button color="success" variant="contained" disabled={actionLoading} onClick={() => onApprove().catch(() => undefined)}>اعتماد الدفع</Button>
            <Button color="error" variant="contained" disabled={actionLoading} onClick={onReject}>رفض الدفع</Button>
          </>
        ) : null}
        {isCod && payment.status === 'pending' ? (
          <Button color="success" variant="contained" disabled={actionLoading} onClick={() => onMarkCollected().catch(() => undefined)}>
            تم تحصيل المبلغ
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}

function PaymentMethodSettings({
  loading,
  actionLoading,
  availableMethods,
  storeMethods,
  fieldErrorsByMethodId,
  onClearFieldError,
  onEnable,
  onSave,
}: {
  loading: boolean;
  actionLoading: boolean;
  availableMethods: PlatformPaymentMethod[];
  storeMethods: StorePaymentMethod[];
  fieldErrorsByMethodId: Record<string, Record<string, string>>;
  onClearFieldError: (methodId: string, fields: string[]) => void;
  onEnable: (platformMethodId: string) => Promise<void>;
  onSave: (method: StorePaymentMethod, patch: Partial<StorePaymentMethod>) => Promise<void>;
}) {
  const storeByPlatformId = new Map(storeMethods.map((method) => [method.platformPaymentMethodId, method]));
  const enabledCount = storeMethods.filter((method) => method.isEnabled).length;

  return (
    <Stack spacing={2}>
      <PageHeader title="طرق الدفع" description="فعّل طرق الدفع الرسمية من النظام وأضف بيانات الحساب التي ستظهر للعميل أثناء الدفع." />
      {enabledCount === 0 ? <Alert severity="info">لم تقم بتفعيل أي طريقة دفع بعد.</Alert> : null}
      {loading ? <CircularProgress /> : null}
      {availableMethods.map((platformMethod) => {
        const storeMethod = storeByPlatformId.get(platformMethod.id);
        return (
          <SectionCard key={platformMethod.id}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{platformMethod.nameAr}</Typography>
                  <Typography color="text.secondary">{platformMethod.descriptionAr ?? platformMethod.nameEn}</Typography>
                </Box>
                {storeMethod ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography>تفعيل</Typography>
                    <Switch
                      checked={storeMethod.isEnabled}
                      disabled={actionLoading}
                      onChange={(event) => onSave(storeMethod, { isEnabled: event.target.checked }).catch(() => undefined)}
                    />
                  </Stack>
                ) : (
                  <Button variant="contained" disabled={actionLoading} onClick={() => onEnable(platformMethod.id).catch(() => undefined)}>
                    إضافة للمتجر
                  </Button>
                )}
              </Stack>
              {storeMethod && platformMethod.type !== 'cod' ? (
                <StoreMethodForm
                  method={storeMethod}
                  disabled={actionLoading}
                  fieldErrors={fieldErrorsByMethodId[storeMethod.id] ?? {}}
                  onClearFieldError={(fields) => onClearFieldError(storeMethod.id, fields)}
                  onSave={onSave}
                />
              ) : null}
              {storeMethod && platformMethod.type === 'cod' ? (
                <Alert severity="info">الدفع عند الاستلام لا يحتاج اسم حساب أو رقم حساب.</Alert>
              ) : null}
            </Stack>
          </SectionCard>
        );
      })}
    </Stack>
  );
}

function StoreMethodForm({
  method,
  disabled,
  fieldErrors,
  onClearFieldError,
  onSave,
}: {
  method: StorePaymentMethod;
  disabled: boolean;
  fieldErrors: Record<string, string>;
  onClearFieldError: (fields: string[]) => void;
  onSave: (method: StorePaymentMethod, patch: Partial<StorePaymentMethod>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    accountName: method.accountName ?? '',
    accountNumber: method.accountNumber ?? '',
    phoneNumber: method.phoneNumber ?? '',
    iban: method.iban ?? '',
    instructionsAr: method.instructionsAr ?? '',
    sortOrder: method.sortOrder,
  });

  return (
    <Stack spacing={2}>
      <Alert severity="info">ستظهر هذه البيانات للعميل أثناء الدفع.</Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="اسم الحساب" value={draft.accountName} error={Boolean(fieldErrors.accountName)} helperText={fieldErrors.accountName} onChange={(e) => { onClearFieldError(['accountName']); setDraft({ ...draft, accountName: e.target.value }); }} fullWidth />
        <TextField label="رقم الحساب / المحفظة" value={draft.accountNumber} error={Boolean(fieldErrors.accountNumber)} helperText={fieldErrors.accountNumber} onChange={(e) => { onClearFieldError(['accountNumber']); setDraft({ ...draft, accountNumber: e.target.value }); }} fullWidth />
        <TextField label="رقم الهاتف" value={draft.phoneNumber} error={Boolean(fieldErrors.phoneNumber)} helperText={fieldErrors.phoneNumber} onChange={(e) => { onClearFieldError(['phoneNumber']); setDraft({ ...draft, phoneNumber: e.target.value }); }} fullWidth />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="IBAN" value={draft.iban} error={Boolean(fieldErrors.iban)} helperText={fieldErrors.iban} onChange={(e) => { onClearFieldError(['iban']); setDraft({ ...draft, iban: e.target.value }); }} fullWidth />
        <TextField select label="الترتيب" value={draft.sortOrder} error={Boolean(fieldErrors.sortOrder)} helperText={fieldErrors.sortOrder} onChange={(e) => { onClearFieldError(['sortOrder']); setDraft({ ...draft, sortOrder: Number(e.target.value) }); }} fullWidth>
          {[1, 2, 3, 4, 5, 6, 10, 20, 50, 100].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
      </Stack>
      <TextField label="تعليمات الدفع للعميل" value={draft.instructionsAr} error={Boolean(fieldErrors.instructionsAr)} helperText={fieldErrors.instructionsAr} onChange={(e) => { onClearFieldError(['instructionsAr']); setDraft({ ...draft, instructionsAr: e.target.value }); }} multiline rows={3} />
      <Button
        variant="contained"
        disabled={disabled}
        onClick={() => onSave(method, { ...draft, instructionsEn: method.instructionsEn }).catch(() => undefined)}
        sx={{ alignSelf: 'flex-start' }}
      >
        حفظ بيانات الحساب
      </Button>
    </Stack>
  );
}

function mapPaymentMethodFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    accountName: ['accountName'],
    accountNumber: ['accountNumber'],
    phoneNumber: ['phoneNumber'],
    iban: ['iban'],
    instructionsAr: ['instructionsAr'],
    sortOrder: ['sortOrder'],
  });
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={700}>{value ?? '-'}</Typography>
    </Box>
  );
}

