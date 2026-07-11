import { NotificationsActiveOutlinedIcon, PeopleOutlineOutlinedIcon, SellOutlinedIcon, ShoppingBagOutlinedIcon } from '../../../../components/icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
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
  RestockOverviewResponse,
  RestockProductStatsListResponse,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader, StatCard } from '../../components/ui';

interface RestockAlertsPanelProps {
  request: MerchantRequester;
}

export function RestockAlertsPanel({ request }: RestockAlertsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [overview, setOverview] = useState<RestockOverviewResponse>({
    subscribersCount: 0,
    sentCount: 0,
    ordersCount: 0,
    salesAmount: 0,
  });
  const [products, setProducts] = useState<RestockProductStatsListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
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

      const [overviewResponse, productsResponse] = await Promise.all([
        request<RestockOverviewResponse>('/customers/manage/restock/overview', { method: 'GET' }),
        request<RestockProductStatsListResponse>(
          `/customers/manage/restock/products?${params.toString()}`,
          { method: 'GET' },
        ),
      ]);

      setOverview(
        overviewResponse ?? {
          subscribersCount: 0,
          sentCount: 0,
          ordersCount: 0,
          salesAmount: 0,
        },
      );
      setProducts(
        productsResponse ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 30,
        },
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load restock analytics.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppPage>
      <PageHeader
        title="تنبيهات توفر المخزون"
        description="متابعة المشتركين والتنبيهات المرسلة والطلبات والمبيعات الناتجة عن تنبيهات العودة للمخزون."
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
          title="عدد المسجلين"
          value={overview.subscribersCount.toLocaleString('ar-EG')}
          icon={<PeopleOutlineOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="عدد التنبيهات المرسلة"
          value={overview.sentCount.toLocaleString('ar-EG')}
          icon={<NotificationsActiveOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="الطلبات الناتجة"
          value={overview.ordersCount.toLocaleString('ar-EG')}
          icon={<ShoppingBagOutlinedIcon fontSize="small" />}
        />
        <StatCard
          title="المبيعات الناتجة"
          value={overview.salesAmount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
          icon={<SellOutlinedIcon fontSize="small" />}
        />
      </div>

      <FilterBar>
        <TextField
          placeholder="بحث باسم المنتج أو الرابط"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <Button variant="contained" onClick={() => loadData().catch(() => undefined)}>
          بحث
        </Button>
      </FilterBar>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>المنتج</TableCell>
                <TableCell>المسجلون</TableCell>
                <TableCell>المرسل</TableCell>
                <TableCell>الطلبات الناتجة</TableCell>
                <TableCell>المبيعات الناتجة</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : products.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد بيانات حتى الآن.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.items.map((item) => (
                  <TableRow key={item.productId} hover>
                    <TableCell>{item.productTitle}</TableCell>
                    <TableCell>{item.subscribersCount.toLocaleString('ar-EG')}</TableCell>
                    <TableCell>{item.sentCount.toLocaleString('ar-EG')}</TableCell>
                    <TableCell>{item.ordersCount.toLocaleString('ar-EG')}</TableCell>
                    <TableCell>
                      {item.salesAmount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}
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
