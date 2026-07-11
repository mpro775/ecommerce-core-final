import { Alert, Box, Stack } from '@mui/material';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsOperations } from '../types';
import { AppPage, PageHeader, StatCard } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

export function AnalyticsOperationsPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters);
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsOperations>(
    request,
    '/analytics/operations',
    query,
    undefined,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="تحليلات العمليات" description="أداء التنفيذ والتجهيز والتوصيل." />
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
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5,1fr)' } }}>
            <StatCard title="طلبات التوصيل" value={String(data.kpis.totalShipments)} />
            <StatCard title="عدد الطلبات" value={String(data.kpis.totalOrders)} />
            <StatCard title="متوسط تجهيز الطلب" value={`${data.kpis.avgOrderPreparationMinutes.toFixed(1)} دقيقة`} />
            <StatCard title="متوسط وقت التوصيل" value={`${data.kpis.avgDeliveryMinutes.toFixed(1)} دقيقة`} />
            <StatCard title="متوسط وقت الإرجاع" value={`${data.kpis.avgReturnMinutes.toFixed(1)} دقيقة`} />
          </Box>
        </Stack>
      ) : null}
        </>
      )}
    </AppPage>
  );
}

