import { Alert, Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MerchantRequester } from '../merchant-dashboard.types';
import type { AnalyticsGeneral } from '../types';
import { AppPage, PageHeader, StatCard } from '../components/ui';
import { LockedFeaturePage, useFeatureGate } from '../feature-gates';
import { AnalyticsFiltersBar, AnalyticsLoadingState, buildAnalyticsQuery, useAnalyticsData, useAnalyticsFilters } from './analytics-common';

function money(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

export function AnalyticsGeneralPanel({ request }: { request: MerchantRequester }) {
  const [filters, setFilters] = useAnalyticsFilters();
  const query = buildAnalyticsQuery(filters);
  const featureGate = useFeatureGate(request, 'advanced_analytics');
  const { data, loading, error, refresh } = useAnalyticsData<AnalyticsGeneral>(
    request,
    '/analytics/general',
    query,
    undefined,
    featureGate.isEnabled,
  );

  return (
    <AppPage>
      <PageHeader title="التحليلات العامة" description="نظرة شاملة على المبيعات والزيارات والتحويل والأداء." />
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
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4,1fr)' } }}>
            <StatCard title="إجمالي المبيعات" value={money(data.summary.totalSales, data.currencyCode)} />
            <StatCard title="عدد الطلبات" value={String(data.summary.totalOrders)} />
            <StatCard title="عدد الجلسات" value={String(data.summary.totalSessions)} />
            <StatCard title="عدد العملاء" value={String(data.summary.totalCustomers)} />
          </Box>

          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography fontWeight={700} mb={1}>
              مخطط المبيعات
            </Typography>
            <Box sx={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#502E91" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,1fr)' } }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={700} mb={1}>
                قمع رحلة العميل
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>المرحلة</TableCell>
                    <TableCell align="center">الجلسات</TableCell>
                    <TableCell align="right">التحويل</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.customerJourneyFunnel.map((row) => (
                    <TableRow key={row.event}>
                      <TableCell>{row.event}</TableCell>
                      <TableCell align="center">{row.sessions}</TableCell>
                      <TableCell align="right">{row.fromVisitRate.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography fontWeight={700} mb={1}>
                مصادر الزيارات
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>النوع</TableCell>
                    <TableCell align="center">زيارات</TableCell>
                    <TableCell align="right">Checkouts</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.trafficSources.split.map((row) => (
                    <TableRow key={row.sourceType}>
                      <TableCell>{row.sourceType}</TableCell>
                      <TableCell align="center">{row.visits}</TableCell>
                      <TableCell align="right">{row.checkouts}</TableCell>
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

