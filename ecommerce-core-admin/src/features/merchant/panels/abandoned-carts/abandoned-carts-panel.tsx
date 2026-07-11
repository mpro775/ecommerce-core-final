import { MarkEmailReadOutlinedIcon, ReplayOutlinedIcon, ShoppingCartCheckoutOutlinedIcon } from '../../../../components/icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
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
import type { ManagedAbandonedCartListResponse, ManagedAbandonedCartStatus } from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader, StatCard } from '../../components/ui';

interface AbandonedCartsPanelProps {
  request: MerchantRequester;
}

const STATUS_OPTIONS: Array<{ value: ManagedAbandonedCartStatus | 'all'; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'ready', label: 'جاهزة للإرسال' },
  { value: 'sent', label: 'تم الإرسال' },
  { value: 'recovered', label: 'تم الاسترجاع' },
  { value: 'expired', label: 'منتهية' },
];

export function AbandonedCartsPanel({ request }: AbandonedCartsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ManagedAbandonedCartStatus | 'all'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [list, setList] = useState<ManagedAbandonedCartListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 30,
  });

  useEffect(() => {
    loadData().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(): Promise<void> {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ page: '1', limit: '30' });
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await request<ManagedAbandonedCartListResponse>(
        `/customers/manage/abandoned-carts?${params.toString()}`,
        { method: 'GET' },
      );

      setList(
        response ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 30,
        },
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'تعذر تحميل بيانات السلات المتروكة.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendRecoveryEmail(abandonedCartId: string): Promise<void> {
    setSendingId(abandonedCartId);
    setMessage(null);
    try {
      await request(`/customers/manage/abandoned-carts/${abandonedCartId}/send-recovery`, {
        method: 'POST',
      });
      setMessage({ type: 'success', text: 'تم إرسال رسالة استرجاع السلة بنجاح.' });
      await loadData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'فشل إرسال رسالة الاسترجاع.',
      });
    } finally {
      setSendingId(null);
    }
  }

  const readyCount = list.items.filter((item) => item.status === 'ready').length;
  const sentCount = list.items.filter((item) => item.status === 'sent').length;
  const recoveredCount = list.items.filter((item) => item.status === 'recovered').length;

  return (
    <AppPage>
      <PageHeader
        title="السلات المتروكة"
        description="متابعة السلات المهجورة وإرسال تذكيرات الاسترجاع وتتبع التحويلات بشكل مباشر."
        actions={
          <Button variant="outlined" onClick={() => loadData().catch(() => undefined)} disabled={loading}>
            تحديث
          </Button>
        }
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          title="إجمالي السلات"
          value={list.total.toLocaleString('ar-EG')}
          icon={<ShoppingCartCheckoutOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="جاهزة للإرسال"
          value={readyCount.toLocaleString('ar-EG')}
          icon={<ReplayOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="مرسلة"
          value={sentCount.toLocaleString('ar-EG')}
          icon={<MarkEmailReadOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="مسترجعة"
          value={recoveredCount.toLocaleString('ar-EG')}
          icon={<ShoppingCartCheckoutOutlinedIcon fontSize="small" />}
        />
      </div>

      <FilterBar>
        <TextField
          placeholder="بحث بالعميل أو البريد أو الهاتف"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <TextField
          select
          label="الحالة"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ManagedAbandonedCartStatus | 'all')}
          sx={{ minWidth: 190 }}
        >
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={() => loadData().catch(() => undefined)}>
          بحث
        </Button>
      </FilterBar>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>العميل</TableCell>
                <TableCell>التواصل</TableCell>
                <TableCell>إجمالي السلة</TableCell>
                <TableCell>العناصر</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>وقت الهجر</TableCell>
                <TableCell>وقت الإرسال</TableCell>
                <TableCell>وقت الاسترجاع</TableCell>
                <TableCell>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : list.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد سلات متروكة مطابقة للبحث.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.customerName || 'زائر'}</TableCell>
                    <TableCell>
                      {item.customerEmail || '-'}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {item.customerPhone || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.cartTotal.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{item.itemsCount}</TableCell>
                    <TableCell>{statusLabel(item.status)}</TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString('ar-EG')}</TableCell>
                    <TableCell>{item.recoverySentAt ? new Date(item.recoverySentAt).toLocaleString('ar-EG') : '-'}</TableCell>
                    <TableCell>{item.recoveredAt ? new Date(item.recoveredAt).toLocaleString('ar-EG') : '-'}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={sendingId === item.id || item.status === 'expired' || item.status === 'recovered'}
                        onClick={() => sendRecoveryEmail(item.id).catch(() => undefined)}
                      >
                        إرسال تذكير
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTableWrapper>
    </AppPage>
  );
}

function statusLabel(status: ManagedAbandonedCartStatus): string {
  if (status === 'ready') {
    return 'جاهزة للإرسال';
  }
  if (status === 'sent') {
    return 'مرسلة';
  }
  if (status === 'recovered') {
    return 'مسترجعة';
  }
  return 'منتهية';
}
