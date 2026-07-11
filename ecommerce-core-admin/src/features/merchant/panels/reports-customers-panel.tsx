import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import type { MerchantRequester } from '../merchant-dashboard.types';
import { AppPage, PageHeader } from '../components/ui';
import { AnalyticsFiltersBar, buildAnalyticsQuery, useAnalyticsFilters } from './analytics-common';

export function ReportsCustomersPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const query = buildAnalyticsQuery(filters);
  const refresh = () => undefined;

  const download = async () => {
    setLoading(true);
    setError('');
    try {
      const blob = await request<Blob>(`/analytics/reports/customers.csv?${query}`, { method: 'GET' }, { responseType: 'blob' });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppPage>
      <PageHeader title="تقارير العملاء" description="تقرير العملاء مع تصدير CSV." />
      <AnalyticsFiltersBar filters={filters} onChange={setFilters} onRefresh={refresh} />
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={download}>
          تصدير CSV
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          التقرير جاهز للتصدير حسب الفلاتر.
        </Typography>
      )}
    </AppPage>
  );
}
