import { Alert, Box } from '@mui/material';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsFinancial } from '../types';
import { AppPage, PageHeader, StatCard } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

function money(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

export function AnalyticsFinancialPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters);
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsFinancial>(
    request,
    '/analytics/financial',
    query,
    undefined,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="التحليلات المالية" description="نظرة عامة على المبيعات والخصومات وقيمة الشحن." />
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
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4,1fr)' } }}>
          <StatCard title="إجمالي قيمة المبيعات" value={money(data.totals.grossSalesValue, data.currencyCode)} />
          <StatCard title="عدد الطلبات" value={String(data.totals.ordersCount)} />
          <StatCard title="إجمالي قيمة مبيعات المنتجات" value={money(data.totals.productsSalesValue, data.currencyCode)} />
          <StatCard title="إجمالي قيمة الشحن" value={money(data.totals.shippingValue, data.currencyCode)} />
          <StatCard title="إجمالي الخصومات" value={money(data.totals.discountValue, data.currencyCode)} />
        </Box>
      ) : null}
        </>
      )}
    </AppPage>
  );
}

