import { Alert, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsProductsTable } from '../types';
import { AppPage, DataTableWrapper, PageHeader } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

function money(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

export function AnalyticsProductsPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters);
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsProductsTable>(
    request,
    '/analytics/products',
    query,
    undefined,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="تحليلات المنتجات" description="الأداء البيعي والخصومات على مستوى المنتج." />
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
      <DataTableWrapper>
        {loading ? (
          <AnalyticsLoadingState />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>المنتج</TableCell>
                <TableCell align="right">إجمالي المبيعات</TableCell>
                <TableCell align="right">إجمالي الخصومات</TableCell>
                <TableCell align="right">عدد المبيعات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.items ?? []).map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>{row.productTitle}</TableCell>
                  <TableCell align="right">{money(row.totalSales, data?.currencyCode ?? 'YER')}</TableCell>
                  <TableCell align="right">{money(row.totalDiscounts, data?.currencyCode ?? 'YER')}</TableCell>
                  <TableCell align="right">{row.salesCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableWrapper>
        </>
      )}
    </AppPage>
  );
}
