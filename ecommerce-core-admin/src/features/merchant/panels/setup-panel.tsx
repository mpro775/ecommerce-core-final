import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import {
  ArrowForwardIcon,
  CheckCircleIcon,
  FactCheckIcon,
  PlayCircleOutlineIcon,
  SettingsSuggestIcon,
  SyncIcon,
  WarningAmberIcon,
} from '../../../components/icons';
import type { MerchantRequester, MerchantTabKey } from '../merchant-dashboard.types';
import type { StoreReadiness, StoreReadinessStep, SetupStepStatus } from '../types';
import {
  AppPage,
  EmptyState,
  LoadingBlock,
  SectionCard,
  SoftPanel,
  SoftRow,
} from '../components/ui';
import { ADMIN_TOKENS } from '../../../theme/tokens';

interface SetupPanelProps {
  request: MerchantRequester;
  onNavigate: (tab: MerchantTabKey) => void;
}

interface ReadinessSummaryCardProps {
  request: MerchantRequester;
  onOpenSetup: () => void;
}

const numberFormatter = new Intl.NumberFormat('ar-SA-u-nu-latn');

export function useStoreReadiness(request: MerchantRequester) {
  const [data, setData] = useState<StoreReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await request<StoreReadiness>('/merchant/store-readiness', { method: 'GET' });
      setData(response ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل جاهزية المتجر.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

export function ReadinessSummaryCard({ request, onOpenSetup }: ReadinessSummaryCardProps) {
  const theme = useTheme();
  const { data, loading, error } = useStoreReadiness(request);

  if (loading) {
    return (
      <SectionCard dense>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
            جار تحديث نسبة الجاهزية
          </Typography>
        </Stack>
      </SectionCard>
    );
  }

  if (error || !data) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 3 }}>
        {error || 'تعذر حساب نسبة الجاهزية حالياً.'}
      </Alert>
    );
  }

  return (
    <SectionCard
      dense
      sx={{
        cursor: 'pointer',
        borderColor: alpha(theme.palette.primary.main, 0.22),
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={onOpenSetup}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onOpenSetup();
          }
        }}
        sx={{ outline: 'none' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                icon={<SettingsSuggestIcon fontSize="small" />}
                label="جاهزية المتجر"
                color={data.canReceiveOrders ? 'success' : 'warning'}
                sx={{ fontWeight: 900 }}
              />
              <Chip
                label={data.canReceiveOrders ? 'يمكن استقبال الطلبات' : 'غير جاهز للبيع'}
                variant="outlined"
                color={data.canReceiveOrders ? 'success' : 'error'}
                sx={{ fontWeight: 800 }}
              />
            </Stack>
            <Typography variant="h4" sx={{ mt: 1.2, fontWeight: 950, letterSpacing: 0 }}>
              {numberFormatter.format(data.score)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={data.score}
              color={data.canReceiveOrders ? 'success' : 'warning'}
              sx={{ mt: 1, height: 9, borderRadius: 999 }}
            />
          </Box>
          <Button endIcon={<ArrowForwardIcon fontSize="small" />} variant="contained" onClick={onOpenSetup}>
            فتح التهيئة
          </Button>
        </Stack>
      </Box>
    </SectionCard>
  );
}

export function SetupPanel({ request, onNavigate }: SetupPanelProps) {
  const theme = useTheme();
  const { data, loading, error, reload, setData } = useStoreReadiness(request);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runQuickAction = useCallback(
    async (action: string) => {
      setBusyAction(action);
      try {
        const next = await request<StoreReadiness>(`/merchant/store-readiness/quick-actions/${action}`, {
          method: 'POST',
        });
        if (next) setData(next);
      } finally {
        setBusyAction(null);
      }
    },
    [request, setData],
  );

  const skipStep = useCallback(
    async (step: StoreReadinessStep) => {
      setBusyAction(`skip:${step.key}`);
      try {
        const next = await request<StoreReadiness>(
          `/merchant/store-readiness/steps/${encodeURIComponent(step.key)}/skip`,
          {
            method: 'POST',
            body: JSON.stringify({ reason: 'merchant_not_needed_now' }),
          },
        );
        if (next) setData(next);
      } finally {
        setBusyAction(null);
      }
    },
    [request, setData],
  );

  const unskipStep = useCallback(
    async (step: StoreReadinessStep) => {
      setBusyAction(`unskip:${step.key}`);
      try {
        const next = await request<StoreReadiness>(
          `/merchant/store-readiness/steps/${encodeURIComponent(step.key)}/skip`,
          { method: 'DELETE' },
        );
        if (next) setData(next);
      } finally {
        setBusyAction(null);
      }
    },
    [request, setData],
  );

  const firstIssue = data?.blockingIssues[0] ?? data?.nextBestAction ?? null;
  const summary = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'النسبة', value: `${numberFormatter.format(data.score)}%` },
      { label: 'الخطوات المكتملة', value: `${numberFormatter.format(data.completedSteps)} / ${numberFormatter.format(data.totalSteps)}` },
      { label: 'موانع البيع', value: numberFormatter.format(data.blockingIssues.length) },
      { label: 'تحسينات مقترحة', value: numberFormatter.format(data.warnings.length) },
    ];
  }, [data]);

  return (
    <AppPage maxWidth={ADMIN_TOKENS.layout.pageMaxWidth}>
      <Stack spacing={2.25}>
        <SectionCard
          title="التهيئة"
          subtitle="مركز جاهزية المتجر للبيع، منفصل عن صفحة الإحصائيات."
          actions={
            <Button startIcon={<SyncIcon fontSize="small" />} variant="outlined" onClick={() => reload()}>
              تحديث
            </Button>
          }
        >
          {loading ? (
            <LoadingBlock />
          ) : error || !data ? (
            <Alert severity="error">{error || 'تعذر تحميل بيانات التهيئة.'}</Alert>
          ) : (
            <Stack spacing={2.25}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                }}
              >
                {summary.map((item) => (
                  <SoftPanel key={item.label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: 0 }}>
                      {item.value}
                    </Typography>
                  </SoftPanel>
                ))}
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900 }}>
                    نسبة الجاهزية
                  </Typography>
                  <Chip
                    color={data.canReceiveOrders ? 'success' : 'error'}
                    label={data.canReceiveOrders ? 'جاهز لاستقبال الطلبات' : 'غير جاهز للبيع'}
                    sx={{ fontWeight: 900 }}
                  />
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={data.score}
                  color={data.canReceiveOrders ? 'success' : 'warning'}
                  sx={{ mt: 1.2, height: 12, borderRadius: 999 }}
                />
              </Box>

              {firstIssue ? (
                <Alert
                  severity={firstIssue.status === 'blocking' ? 'error' : 'warning'}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => onNavigate(firstIssue.actionTab as MerchantTabKey)}
                    >
                      {firstIssue.actionLabel}
                    </Button>
                  }
                  sx={{ borderRadius: 3 }}
                >
                  <Typography sx={{ fontWeight: 900 }}>{firstIssue.title}</Typography>
                  <Typography variant="body2">{firstIssue.description}</Typography>
                </Alert>
              ) : null}
            </Stack>
          )}
        </SectionCard>

        {!loading && data ? (
          data.sections.map((section) => (
            <SectionCard
              key={section.key}
              title={section.title}
              subtitle={`${numberFormatter.format(section.completedSteps)} من ${numberFormatter.format(section.totalSteps)} مكتملة`}
              actions={<StatusChip status={section.status} />}
            >
              <Stack spacing={1.25}>
                {section.steps.map((step) => (
                  <SoftPanel
                    key={step.key}
                    sx={{
                      borderColor: alpha(statusColor(theme, step.status), 0.22),
                      bgcolor: alpha(statusColor(theme, step.status), theme.palette.mode === 'dark' ? 0.08 : 0.045),
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ md: 'center' }}
                      spacing={1.5}
                    >
                      <Stack spacing={0.55} sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <StatusIcon status={step.status} />
                          <Typography variant="body1" sx={{ fontWeight: 950 }}>
                            {step.title}
                          </Typography>
                          <StatusChip status={step.status} />
                          {step.skippable ? <Chip size="small" label="اختياري" variant="outlined" /> : null}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {step.description}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {step.quickAction && step.status !== 'completed' && step.status !== 'skipped' ? (
                          <Button
                            variant="contained"
                            size="small"
                            disabled={busyAction === step.quickAction}
                            onClick={() => runQuickAction(step.quickAction!)}
                          >
                            {busyAction === step.quickAction ? 'جار التنفيذ' : step.actionLabel}
                          </Button>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowForwardIcon fontSize="small" />}
                            onClick={() => onNavigate(step.actionTab as MerchantTabKey)}
                          >
                            {step.actionLabel}
                          </Button>
                        )}
                        {step.status === 'skipped' ? (
                          <Button
                            variant="text"
                            size="small"
                            disabled={busyAction === `unskip:${step.key}`}
                            onClick={() => unskipStep(step)}
                          >
                            إلغاء التخطي
                          </Button>
                        ) : step.skippable && step.status !== 'completed' ? (
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<PlayCircleOutlineIcon fontSize="small" />}
                            disabled={busyAction === `skip:${step.key}`}
                            onClick={() => skipStep(step)}
                          >
                            لا أحتاجها الآن
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </SoftPanel>
                ))}
              </Stack>
            </SectionCard>
          ))
        ) : !loading && !error ? (
          <EmptyState text="لا توجد خطوات تهيئة لعرضها." />
        ) : null}
      </Stack>
    </AppPage>
  );
}

function StatusChip({ status }: { status: SetupStepStatus }) {
  const map: Record<SetupStepStatus, { label: string; color: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
    completed: { label: 'مكتملة', color: 'success' },
    skipped: { label: 'تم التخطي', color: 'info' },
    missing: { label: 'ناقصة', color: 'warning' },
    warning: { label: 'تحسين', color: 'warning' },
    blocking: { label: 'مانعة للبيع', color: 'error' },
  };
  return <Chip size="small" label={map[status].label} color={map[status].color} sx={{ fontWeight: 900 }} />;
}

function StatusIcon({ status }: { status: SetupStepStatus }) {
  if (status === 'completed') return <CheckCircleIcon fontSize="small" color="success" />;
  if (status === 'skipped') return <FactCheckIcon fontSize="small" color="info" />;
  if (status === 'blocking') return <WarningAmberIcon fontSize="small" color="error" />;
  return <SettingsSuggestIcon fontSize="small" color="warning" />;
}

function statusColor(theme: Theme, status: SetupStepStatus) {
  if (status === 'completed') return theme.palette.success.main;
  if (status === 'skipped') return theme.palette.info.main;
  if (status === 'blocking') return theme.palette.error.main;
  return theme.palette.warning.main;
}
