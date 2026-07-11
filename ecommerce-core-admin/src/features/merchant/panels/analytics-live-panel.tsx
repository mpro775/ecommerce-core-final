import { Alert, Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsLive } from '../types';
import { AppPage, PageHeader, StatCard } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

function money(value: number): string {
  return `${value.toFixed(2)} YER`;
}

export function AnalyticsLivePanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters, { liveMinutes: filters.liveMinutes || 15 });
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsLive>(
    request,
    '/analytics/live',
    query,
    30_000,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="التحليلات المباشرة" description="تحليلات فورية لنافذة آخر 15 دقيقة (قابلة للتعديل)." />
      {featureGate.loading ? (
        <AnalyticsLoadingState />
      ) : featureGate.error ? (
        <Alert severity="error">{featureGate.error}</Alert>
      ) : featureGate.isLocked ? (
        <LockedFeaturePage />
      ) : (
        <>
      <AnalyticsFiltersBar filters={filters} onChange={setFilters} onRefresh={refresh} includeLiveMinutes />
      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <AnalyticsLoadingState />
      ) : data ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4,1fr)' } }}>
            <StatCard title="الزيارات الآن" value={String(data.liveVisits)} />
            <StatCard title="إجمالي الطلبات الآن" value={String(data.liveOrders)} />
            <StatCard title="إجمالي المبيعات الآن" value={money(data.liveSales)} />
            <StatCard title="نافذة التتبع" value={`${data.liveMinutes} دقيقة`} />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3,1fr)' } }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={700} mb={1}>
                الصفحات الأكثر زيارة
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>الصفحة</TableCell>
                    <TableCell align="right">الزيارات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.topVisitedPages.map((row) => (
                    <TableRow key={row.page}>
                      <TableCell>{row.page}</TableCell>
                      <TableCell align="right">{row.visits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={700} mb={1}>
                أفضل المدن الآن
              </Typography>
              <Table size="small">
                <TableBody>
                  {data.topCities.map((row) => (
                    <TableRow key={row.city}>
                      <TableCell>{row.city}</TableCell>
                      <TableCell align="right">{row.orders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={700} mb={1}>
                أكثر المنتجات مبيعًا الآن
              </Typography>
              <Table size="small">
                <TableBody>
                  {data.topProducts.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>{row.productTitle}</TableCell>
                      <TableCell align="right">{row.quantitySold}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </Stack>
      ) : null}
        </>
      )}
    </AppPage>
  );
}

