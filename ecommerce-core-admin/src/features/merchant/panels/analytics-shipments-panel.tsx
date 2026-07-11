import { Alert, Box, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsShipments } from '../types';
import { AppPage, PageHeader, StatCard } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

export function AnalyticsShipmentsPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters);
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsShipments>(
    request,
    '/analytics/delivery',
    query,
    undefined,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="تحليلات التوصيل والاستلام" description="متابعة الطلبات حسب طريقة الاستلام ورسوم التوصيل والمناطق الأكثر استخداماً." />
      {featureGate.loading ? (
        <AnalyticsLoadingState />
      ) : featureGate.error ? (
        <Alert severity="error">{featureGate.error}</Alert>
      ) : featureGate.isLocked ? (
        <LockedFeaturePage />
      ) : (
        <>
          <AnalyticsFiltersBar filters={filters} onChange={setFilters} onRefresh={refresh} />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? (
            <AnalyticsLoadingState />
          ) : data ? (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4,1fr)' } }}>
                <StatCard title="إجمالي الطلبات" value={String(data.counts.totalOrders ?? data.counts.totalShipments)} />
                <StatCard title="طلبات التوصيل" value={String(data.counts.deliveryOrders)} />
                <StatCard title="استلام من المتجر" value={String(data.counts.pickupOrders)} />
                <StatCard title="في الطريق" value={String(data.counts.inTransit)} />
                <StatCard title="مكتملة" value={String(data.counts.delivered)} />
                <StatCard title="ملغية" value={String(data.counts.cancelled)} />
                <StatCard title="مرتجعة" value={String(data.counts.failedDelivery)} />
                <StatCard title="إجمالي رسوم التوصيل" value={`${data.fees.totalShippingFees.toFixed(2)} ${data.currencyCode}`} />
                <StatCard title="متوسط رسوم التوصيل" value={`${data.fees.averageShippingFee.toFixed(2)} ${data.currencyCode}`} />
                <StatCard title="معدل الإكمال" value={`${data.rates.deliveredRate.toFixed(2)}%`} />
              </Box>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight={800}>حسب طريقة التوصيل أو الاستلام</Typography>
                  <List dense>
                    {data.methods.map((method) => (
                      <ListItem key={method.key} disableGutters>
                        <ListItemText primary={method.key} secondary={`${method.count} طلب - ${method.amount.toFixed(2)} ${data.currencyCode}`} />
                      </ListItem>
                    ))}
                    {data.methods.length === 0 ? <ListItem disableGutters><ListItemText primary="لا توجد بيانات ضمن الفترة." /></ListItem> : null}
                  </List>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight={800}>أكثر مناطق التوصيل استخداماً</Typography>
                  <List dense>
                    {data.topAreas.map((area) => (
                      <ListItem key={area.area} disableGutters>
                        <ListItemText primary={area.area} secondary={`${area.orders} طلب`} />
                      </ListItem>
                    ))}
                    {data.topAreas.length === 0 ? <ListItem disableGutters><ListItemText primary="لا توجد طلبات توصيل ضمن الفترة." /></ListItem> : null}
                  </List>
                </Paper>
              </Box>
            </Box>
          ) : null}
        </>
      )}
    </AppPage>
  );
}
