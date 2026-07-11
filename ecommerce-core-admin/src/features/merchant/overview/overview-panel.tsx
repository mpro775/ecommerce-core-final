import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { MerchantSession, StoreSettings } from '../types';
import type { MerchantRequester } from '../merchant-dashboard.types';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import {
  AppPage,
  EmptyState,
  GlassSectionBand as SectionBand,
  GlassSectionCard as SectionCard,
  LoadingBlock,
  MetricCard,
  SoftPanel,
  SoftRow,
} from '../components/ui';
import { LockedFeaturePage } from '../feature-gates';
import averageOrderAnimation from './animated-icons/average-order.json';
import cancellationAnimation from './animated-icons/cancellation.json';
import cartRecoveryAnimation from './animated-icons/cart-recovery.json';
import conversionAnimation from './animated-icons/conversion.json';
import customersAnimation from './animated-icons/customers.json';
import dashboardAnimation from './animated-icons/dashboard.json';
import discountAnimation from './animated-icons/discount.json';
import growthAnimation from './animated-icons/growth.json';
import inventoryAnimation from './animated-icons/inventory.json';
import ordersAnimation from './animated-icons/orders.json';
import paymentsAnimation from './animated-icons/payments.json';
import revenueAnimation from './animated-icons/revenue.json';
import salesAnimation from './animated-icons/sales.json';
import shippingAnimation from './animated-icons/shipping.json';
import stockAlertAnimation from './animated-icons/stock-alert.json';
import storeAnimation from './animated-icons/store.json';
import { IconsaxAnimatedIcon } from './iconsax-animated-icon';
import { ReadinessSummaryCard } from '../panels/setup-panel';
import { useMerchantOverviewData } from './use-merchant-overview-data';
import {
  anomalyKeyLabel,
  formatCurrency,
  formatDurationMinutes,
  funnelEventLabel,
  orderStatusLabel,
  qualityCheckLabel,
  transitionLabel,
} from './overview-formatters';

type ChipTone = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const formatNumber = (value: number) => new Intl.NumberFormat('ar-SA-u-nu-latn').format(value);
const formatPercent = (value: number, digits = 2) => `${value.toFixed(digits)}%`;

export function OverviewPanel({
  session,
  request,
  storeSettings,
  onOpenSetup,
}: {
  session: MerchantSession;
  request: MerchantRequester;
  storeSettings?: StoreSettings | null;
  onOpenSetup?: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { data, loading: loadingState, errors, featureGate } = useMerchantOverviewData(request);
  const {
    overview,
    fulfillmentSla,
    paymentsPerformance,
    promotionsEfficiency,
    inventoryHealth,
    stockoutRisk,
    customersRetention,
    funnelConversion,
    sourceAttribution,
    abandonedCartMetrics,
    dataQuality,
    anomalyReport,
  } = data;

  const coreLoading = loadingState.core;
  const commerceLoading = loadingState.commerce;
  const qualityLoading = loadingState.quality;
  const loadingAny = coreLoading || commerceLoading || qualityLoading;
  const error = featureGate.isLocked ? '' : errors.core || errors.commerce || errors.quality;
  const storeName = storeSettings?.name?.trim() || 'المتجر';
  const storeBrandImageUrl = storeSettings?.logoUrl || storeSettings?.faviconUrl || '';
  const currencyCode =
    overview?.currencyCode ??
    paymentsPerformance?.currencyCode ??
    promotionsEfficiency?.currencyCode ??
    stockoutRisk?.currencyCode ??
    customersRetention?.currencyCode ??
    abandonedCartMetrics?.currencyCode ??
    'YER';

  const tones = {
    brand: theme.palette.primary.main,
    brandDark: isDark ? theme.palette.text.primary : theme.palette.primary.dark,
    cyan: theme.palette.secondary.main,
    revenue: theme.palette.success.main,
    orders: theme.palette.primary.main,
    average: theme.palette.warning.main,
    risk: theme.palette.error.main,
    recovery: theme.palette.info.main,
  };
  const overviewIcon = (
    animationData: Record<string, unknown>,
    title: string,
    toneColor = theme.palette.primary.main,
    size = 24,
  ) => (
    <IconsaxAnimatedIcon
      animationData={animationData}
      size={size}
      title={title}
      toneColor={toneColor}
    />
  );

  const kpiCards = [
    {
      title: 'إجمالي المبيعات',
      value: formatCurrency(overview?.kpis.grossSales ?? 0, currencyCode),
      subtitle: 'آخر 30 يوم',
      icon: overviewIcon(revenueAnimation, 'إجمالي المبيعات', tones.revenue),
      tone: tones.revenue,
    },
    {
      title: 'عدد الطلبات',
      value: formatNumber(overview?.kpis.totalOrders ?? 0),
      subtitle: 'طلب مكتمل أو قيد المعالجة',
      icon: overviewIcon(ordersAnimation, 'عدد الطلبات', tones.orders),
      tone: tones.orders,
    },
    {
      title: 'متوسط قيمة الطلب',
      value: formatCurrency(overview?.kpis.averageOrderValue ?? 0, currencyCode),
      subtitle: 'AOV',
      icon: overviewIcon(averageOrderAnimation, 'متوسط قيمة الطلب', tones.average),
      tone: tones.average,
    },
    {
      title: 'نسبة الإلغاء',
      value: formatPercent(overview?.kpis.cancellationRate ?? 0),
      subtitle: 'من إجمالي الطلبات',
      icon: overviewIcon(cancellationAnimation, 'نسبة الإلغاء', tones.risk),
      tone: tones.risk,
    },
    {
      title: 'استرجاع السلات',
      value: formatPercent(abandonedCartMetrics?.kpis.recoveryRate ?? 0),
      subtitle: 'معدل الاسترجاع',
      icon: overviewIcon(cartRecoveryAnimation, 'استرجاع السلات', tones.recovery),
      tone: tones.recovery,
    },
  ];

  const heroStats = [
    { label: 'صافي المبيعات', value: formatCurrency(overview?.kpis.netSales ?? 0, currencyCode) },
    {
      label: 'مدفوعات مقبولة',
      value: formatCurrency(overview?.kpis.approvedPaymentsAmount ?? 0, currencyCode),
    },
    { label: 'معدل قبول الدفع', value: formatPercent(overview?.kpis.approvalRate ?? 0) },
  ];

  return (
    <AppPage maxWidth={ADMIN_TOKENS.layout.pageMaxWidth}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 2.5 },
          p: { xs: 0.5, sm: 0.75, md: 1 },
          borderRadius: { xs: 3, md: 5 },
          background: isDark
            ? `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.035)} 0%, ${alpha(theme.palette.background.paper, 0.32)} 58%, transparent 100%)`
            : `linear-gradient(145deg, rgba(255,255,255,0.36) 0%, ${alpha(theme.palette.primary.light, 0.34)} 54%, rgba(255,255,255,0.18) 100%)`,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: { xs: 3.5, md: 5 },
            p: { xs: 2.25, md: 3.5 },
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.72),
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.84 : 0.58),
            backdropFilter: 'blur(24px)',
            boxShadow: isDark
              ? '0 24px 52px rgba(9, 7, 16, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 28px 60px rgba(80, 46, 145, 0.12)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              insetBlockStart: -130,
              insetInlineEnd: -120,
              width: 320,
              height: 320,
              borderRadius: '50%',
              bgcolor: alpha(
                isDark ? theme.palette.common.white : theme.palette.secondary.main,
                isDark ? 0.045 : 0.18,
              ),
              filter: 'blur(2px)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              display: 'grid',
              gap: { xs: 2.5, lg: 3.5 },
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)' },
              alignItems: 'stretch',
            }}
          >
            <Stack spacing={2.25} justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color={loadingAny ? 'default' : 'success'}
                  label={loadingAny ? 'جاري تحديث البيانات' : 'بيانات آخر 30 يوم'}
                  sx={{ fontWeight: 900, px: 0.5 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={currencyCode}
                  sx={{ fontWeight: 900 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={session.user.role === 'owner' ? 'المالك' : 'عضو فريق'}
                  sx={{ fontWeight: 900 }}
                />
              </Stack>

              <Box>
                <Typography
                  variant="h3"
                  sx={{
                    maxWidth: 720,
                    color: tones.brandDark,
                    fontSize: { xs: '1.65rem', md: '2.35rem' },
                    lineHeight: 1.18,
                    fontWeight: 900,
                    letterSpacing: 0,
                  }}
                >
                  لوحة مؤشرات{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      maxWidth: '100%',
                      px: { xs: 1.1, md: 1.4 },
                      py: { xs: 0.35, md: 0.45 },
                      borderRadius: 2,
                      color: isDark ? theme.palette.common.white : theme.palette.primary.dark,
                      background: isDark
                        ? alpha(theme.palette.primary.main, 0.24)
                        : `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.18)})`,
                      boxShadow: isDark
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                        : `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.1)}`,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {storeName}
                  </Box>
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{
                    maxWidth: 790,
                    mt: 1.25,
                    fontSize: { xs: '0.92rem', md: '1rem' },
                    lineHeight: 1.85,
                    fontWeight: isDark ? 750 : 600,
                  }}
                >
                  قراءة مركزة لأداء المبيعات والطلبات والمخزون والتحويل وجودة البيانات، بنفس بياناتك
                  الحالية لكن بواجهة أكثر نعومة وقرباً من المرجع.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                {heroStats.map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      minWidth: 0,
                      px: 1.75,
                      py: 1.5,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.68),
                      bgcolor: alpha(theme.palette.background.paper, isDark ? 0.54 : 0.62),
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                      {item.label}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ color: 'text.primary', fontWeight: 900, overflowWrap: 'anywhere' }}
                    >
                      {coreLoading ? '-' : item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>

            <Box
              sx={{
                minHeight: 270,
                p: { xs: 2, md: 2.5 },
                borderRadius: { xs: 3, md: 4 },
                border: '1px solid',
                borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.72),
                bgcolor: isDark
                  ? alpha(theme.palette.background.paper, 0.48)
                  : alpha(theme.palette.common.white, 0.46),
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: storeBrandImageUrl ? 2 : '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: theme.palette.common.white,
                    bgcolor: storeBrandImageUrl
                      ? alpha(theme.palette.background.paper, isDark ? 0.82 : 0.9)
                      : theme.palette.primary.main,
                    border: storeBrandImageUrl ? '1px solid' : 'none',
                    borderColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
                    overflow: 'hidden',
                    boxShadow: isDark
                      ? '0 18px 34px rgba(0, 0, 0, 0.28)'
                      : `0 18px 34px ${alpha(theme.palette.primary.main, 0.26)}`,
                  }}
                >
                  {storeBrandImageUrl ? (
                    <Box
                      component="img"
                      src={storeBrandImageUrl}
                      alt={storeName}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        p: 0.75,
                      }}
                    />
                  ) : (
                    overviewIcon(
                      dashboardAnimation,
                      'لوحة المؤشرات',
                      theme.palette.common.white,
                      34,
                    )
                  )}
                </Box>
                <Chip
                  size="small"
                  label="Overview"
                  sx={{
                    color: isDark ? 'primary.main' : theme.palette.primary.dark,
                    bgcolor: isDark
                      ? alpha(theme.palette.common.white, 0.075)
                      : alpha(theme.palette.secondary.main, 0.22),
                    fontWeight: 900,
                  }}
                />
              </Stack>

              <Stack spacing={1.25}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
                  معرّف المتجر
                </Typography>
                <Typography
                  dir="ltr"
                  sx={{
                    width: 'fit-content',
                    maxWidth: '100%',
                    px: 1.5,
                    py: 0.8,
                    borderRadius: 999,
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    color: isDark ? 'text.primary' : tones.brandDark,
                    bgcolor: isDark
                      ? alpha(theme.palette.common.white, 0.07)
                      : alpha(theme.palette.primary.main, 0.08),
                    overflowWrap: 'anywhere',
                  }}
                >
                  {session.user.storeId}
                </Typography>
                <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 900 }}>
                  {session.user.fullName}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  {session.user.permissions.length > 0
                    ? `${session.user.permissions.length} صلاحية مفعلة`
                    : 'لا توجد صلاحيات مخصصة'}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Paper>

        {featureGate.isLocked ? (
          <LockedFeaturePage />
        ) : (
          <>
            {onOpenSetup ? <ReadinessSummaryCard request={request} onOpenSetup={onOpenSetup} /> : null}

            {error ? (
              <Alert
                severity="error"
                sx={{
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.error.main, 0.24),
                }}
              >
                {error}
              </Alert>
            ) : null}

            <Box
              sx={{
                display: 'grid',
                gap: { xs: 1.5, md: 2 },
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' },
              }}
            >
              {kpiCards.map((card) => (
                <MetricCard key={card.title} {...card} value={coreLoading ? '-' : card.value} />
              ))}
            </Box>

            <SectionBand
              title="المبيعات والطلبات"
              icon={overviewIcon(salesAnimation, 'المبيعات والطلبات')}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: '1.25fr 0.75fr' },
                }}
              >
                <SectionCard
                  title="أكثر المنتجات مبيعاً"
                  eyebrow="آخر 30 يوم"
                  icon={overviewIcon(salesAnimation, 'أكثر المنتجات مبيعاً')}
                >
                  {coreLoading ? (
                    <LoadingBlock />
                  ) : (overview?.topProducts.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد مبيعات في الفترة المحددة بعد." />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>المنتج</TableCell>
                            <TableCell align="center">الوحدات</TableCell>
                            <TableCell align="right">الإيراد</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(overview?.topProducts ?? []).map((item) => (
                            <TableRow key={item.productId} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                  {item.productTitle}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatPercent(item.shareOfNetSales)} من صافي المبيعات
                                </Typography>
                              </TableCell>
                              <TableCell align="center">{formatNumber(item.unitsSold)}</TableCell>
                              <TableCell align="right">
                                {formatCurrency(item.revenue, currencyCode)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SectionCard>

                <SectionCard
                  title="توزيع حالات الطلب"
                  eyebrow="آخر 30 يوم"
                  icon={overviewIcon(ordersAnimation, 'توزيع حالات الطلب')}
                >
                  {coreLoading ? (
                    <LoadingBlock />
                  ) : (overview?.ordersByStatus.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد حالات طلبات في الفترة الحالية." />
                  ) : (
                    <Stack spacing={1}>
                      {(overview?.ordersByStatus ?? []).map((item) => (
                        <SoftRow
                          key={item.status}
                          label={orderStatusLabel(item.status)}
                          value={<Chip size="small" label={formatNumber(item.count)} />}
                        />
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              </Box>
            </SectionBand>

            <SectionBand
              title="التشغيل والمدفوعات"
              icon={overviewIcon(paymentsAnimation, 'التشغيل والمدفوعات')}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                <SectionCard
                  title="أداء التجهيز والشحن"
                  icon={overviewIcon(shippingAnimation, 'أداء التجهيز والشحن')}
                >
                  {coreLoading ? (
                    <LoadingBlock />
                  ) : (fulfillmentSla?.items.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد عينات شحن كافية بعد." />
                  ) : (
                    <Stack spacing={1.2}>
                      {(fulfillmentSla?.items ?? []).map((item) => (
                        <SoftPanel key={item.transition}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            {transitionLabel(item.transition)}
                          </Typography>
                          <SoftRow
                            label="P50"
                            value={formatDurationMinutes(item.p50Minutes)}
                            compact
                          />
                          <SoftRow
                            label="P90"
                            value={formatDurationMinutes(item.p90Minutes)}
                            compact
                          />
                          <Typography variant="caption" color="text.secondary">
                            عينات: {formatNumber(item.sampleCount)}
                          </Typography>
                        </SoftPanel>
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="أداء المدفوعات"
                  icon={overviewIcon(paymentsAnimation, 'أداء المدفوعات')}
                >
                  {coreLoading ? (
                    <LoadingBlock />
                  ) : (
                    <Stack spacing={1}>
                      <SoftRow
                        label="نسبة القبول"
                        value={formatPercent(paymentsPerformance?.kpis.approvalRate ?? 0)}
                      />
                      <SoftRow
                        label="قيمة المدفوعات المقبولة"
                        value={formatCurrency(
                          paymentsPerformance?.kpis.approvedAmount ?? 0,
                          currencyCode,
                        )}
                      />
                      <SoftRow
                        label="قيد المراجعة"
                        value={
                          <Chip
                            size="small"
                            label={paymentsPerformance?.kpis.underReviewPayments ?? 0}
                          />
                        }
                      />
                      <SoftRow
                        label="زمن المراجعة P50"
                        value={formatDurationMinutes(
                          paymentsPerformance?.kpis.p50ReviewMinutes ?? 0,
                        )}
                      />
                      <SoftRow
                        label="زمن المراجعة P90"
                        value={formatDurationMinutes(
                          paymentsPerformance?.kpis.p90ReviewMinutes ?? 0,
                        )}
                      />
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="كفاءة الخصومات"
                  icon={overviewIcon(discountAnimation, 'كفاءة الخصومات')}
                >
                  {coreLoading ? (
                    <LoadingBlock />
                  ) : (
                    <Stack spacing={1}>
                      <SoftRow
                        label="إجمالي الخصم"
                        value={formatCurrency(
                          promotionsEfficiency?.kpis.discountTotal ?? 0,
                          currencyCode,
                        )}
                      />
                      <SoftRow
                        label="معدل الخصم من الصافي"
                        value={formatPercent(promotionsEfficiency?.kpis.discountRate ?? 0)}
                      />
                      <SoftRow
                        label="العائد لكل 1 خصم"
                        value={`${(promotionsEfficiency?.kpis.revenuePerDiscountUnit ?? 0).toFixed(2)}x`}
                      />
                      <SoftRow
                        label="طلبات بكوبون"
                        value={
                          <Chip size="small" label={promotionsEfficiency?.kpis.couponOrders ?? 0} />
                        }
                      />
                    </Stack>
                  )}
                </SectionCard>
              </Box>

              <SectionCard
                title="أفضل الكوبونات أداءً"
                eyebrow="آخر 30 يوم"
                icon={overviewIcon(discountAnimation, 'أفضل الكوبونات أداءً')}
              >
                {coreLoading ? (
                  <LoadingBlock />
                ) : (promotionsEfficiency?.topCoupons.length ?? 0) === 0 ? (
                  <EmptyState text="لا يوجد استخدام للكوبونات في الفترة الحالية." />
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>الكوبون</TableCell>
                          <TableCell align="center">عدد الطلبات</TableCell>
                          <TableCell align="right">الخصم</TableCell>
                          <TableCell align="right">صافي المبيعات</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(promotionsEfficiency?.topCoupons ?? []).map((coupon) => (
                          <TableRow key={coupon.couponCode} hover>
                            <TableCell sx={{ fontWeight: 900 }}>{coupon.couponCode}</TableCell>
                            <TableCell align="center">{formatNumber(coupon.ordersCount)}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(coupon.discountTotal, currencyCode)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(coupon.netSales, currencyCode)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </SectionCard>
            </SectionBand>

            <SectionBand
              title="المخزون والعملاء"
              icon={overviewIcon(inventoryAnimation, 'المخزون والعملاء')}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                <SectionCard
                  title="صحة المخزون"
                  icon={overviewIcon(inventoryAnimation, 'صحة المخزون')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (
                    <Stack spacing={1}>
                      <SoftRow
                        label="إجمالي المتغيرات"
                        value={formatNumber(inventoryHealth?.kpis.totalVariants ?? 0)}
                      />
                      <SoftRow
                        label="منخفضة المخزون"
                        value={
                          <Chip
                            size="small"
                            color="warning"
                            label={inventoryHealth?.kpis.lowStockVariants ?? 0}
                          />
                        }
                      />
                      <SoftRow
                        label="نفد مخزونها"
                        value={
                          <Chip
                            size="small"
                            color="error"
                            label={inventoryHealth?.kpis.outOfStockVariants ?? 0}
                          />
                        }
                      />
                      <SoftRow
                        label="الوحدات المحجوزة"
                        value={formatNumber(inventoryHealth?.kpis.reservedUnits ?? 0)}
                      />
                      <SoftRow
                        label="معدل الحركة"
                        value={formatPercent(inventoryHealth?.kpis.sellThroughRate ?? 0)}
                      />
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="احتياج إعادة تموين"
                  icon={overviewIcon(stockAlertAnimation, 'احتياج إعادة تموين', tones.risk)}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (stockoutRisk?.items.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد مخاطر واضحة حالياً." />
                  ) : (
                    <Stack spacing={1.2}>
                      {(stockoutRisk?.items ?? []).slice(0, 5).map((item) => (
                        <SoftPanel key={item.variantId}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            {item.productTitle}
                          </Typography>
                          <SoftRow
                            label="التغطية"
                            value={`${item.daysOfCover.toFixed(1)} يوم`}
                            compact
                          />
                          <SoftRow
                            label="المتاح"
                            value={formatNumber(item.availableQuantity)}
                            compact
                          />
                        </SoftPanel>
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="ولاء العملاء"
                  icon={overviewIcon(customersAnimation, 'ولاء العملاء')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (
                    <Stack spacing={1}>
                      <SoftRow
                        label="عملاء نشطون"
                        value={formatNumber(customersRetention?.kpis.activeCustomers ?? 0)}
                      />
                      <SoftRow
                        label="عملاء جدد"
                        value={formatNumber(customersRetention?.kpis.newCustomers ?? 0)}
                      />
                      <SoftRow
                        label="عملاء عائدون"
                        value={formatNumber(customersRetention?.kpis.returningCustomers ?? 0)}
                      />
                      <SoftRow
                        label="معدل إعادة الشراء"
                        value={formatPercent(customersRetention?.kpis.repeatPurchaseRate ?? 0)}
                      />
                      <SoftRow
                        label="متوسط طلبات/عميل"
                        value={(customersRetention?.kpis.averageOrdersPerCustomer ?? 0).toFixed(2)}
                      />
                    </Stack>
                  )}
                </SectionCard>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                <SectionCard
                  title="منتجات بطيئة الحركة"
                  icon={overviewIcon(inventoryAnimation, 'منتجات بطيئة الحركة')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (inventoryHealth?.slowMovingItems.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد منتجات راكدة في هذه الفترة." />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>المنتج</TableCell>
                            <TableCell align="center">SKU</TableCell>
                            <TableCell align="right">المتاح</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(inventoryHealth?.slowMovingItems ?? []).map((item) => (
                            <TableRow key={item.variantId} hover>
                              <TableCell sx={{ fontWeight: 800 }}>{item.productTitle}</TableCell>
                              <TableCell align="center">{item.sku}</TableCell>
                              <TableCell align="right">
                                {formatNumber(item.availableQuantity)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SectionCard>

                <SectionCard
                  title="أكثر العملاء تكراراً"
                  icon={overviewIcon(customersAnimation, 'أكثر العملاء تكراراً')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (customersRetention?.topRepeatCustomers.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد بيانات كافية بعد." />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>العميل</TableCell>
                            <TableCell align="center">طلبات الفترة</TableCell>
                            <TableCell align="center">طلبات إجمالية</TableCell>
                            <TableCell align="right">صافي المبيعات</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(customersRetention?.topRepeatCustomers ?? []).map((customer) => (
                            <TableRow key={customer.customerId} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                  {customer.fullName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" dir="ltr">
                                  {customer.phone}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {formatNumber(customer.ordersInWindow)}
                              </TableCell>
                              <TableCell align="center">
                                {formatNumber(customer.lifetimeOrders)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(customer.netSalesInWindow, currencyCode)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SectionCard>
              </Box>
            </SectionBand>

            <SectionBand
              title="التحويل والجودة"
              icon={overviewIcon(conversionAnimation, 'التحويل والجودة')}
            >
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                <SectionCard
                  title="قمع التحويل"
                  icon={overviewIcon(conversionAnimation, 'قمع التحويل')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (funnelConversion?.stages.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد مراحل تحويل كافية بعد." />
                  ) : (
                    <Stack spacing={1.2}>
                      {(funnelConversion?.stages ?? []).map((stage) => (
                        <SoftPanel key={stage.event}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>
                              {funnelEventLabel(stage.event)}
                            </Typography>
                            <Chip size="small" label={formatNumber(stage.sessions)} />
                          </Stack>
                          <SoftRow
                            label="تحويل المرحلة"
                            value={formatPercent(stage.stepConversionRate)}
                            compact
                          />
                          <SoftRow
                            label="من الزيارة"
                            value={formatPercent(stage.fromVisitRate)}
                            compact
                          />
                        </SoftPanel>
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="نسبة التحويل حسب المصدر"
                  icon={overviewIcon(growthAnimation, 'نسبة التحويل حسب المصدر')}
                >
                  {commerceLoading ? (
                    <LoadingBlock />
                  ) : (sourceAttribution?.items.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد بيانات مصادر كافية بعد." />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>المصدر</TableCell>
                            <TableCell align="center">زيارات</TableCell>
                            <TableCell align="center">تحقق الدفع</TableCell>
                            <TableCell align="right">التحويل</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(sourceAttribution?.items ?? []).map((item) => (
                            <TableRow key={`${item.source}-${item.medium}-${item.campaign}`} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                  {item.source}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.medium} / {item.campaign}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">{formatNumber(item.visits)}</TableCell>
                              <TableCell align="center">{formatNumber(item.checkouts)}</TableCell>
                              <TableCell align="right">
                                {formatPercent(item.visitToCheckoutRate)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SectionCard>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', lg: '0.8fr 1.2fr' },
                }}
              >
                <SectionCard
                  title="حوكمة البيانات"
                  icon={overviewIcon(dashboardAnimation, 'حوكمة البيانات')}
                >
                  {qualityLoading ? (
                    <LoadingBlock />
                  ) : (
                    <Stack spacing={1.1}>
                      <SoftRow
                        label="درجة الجودة"
                        value={
                          <Chip
                            size="small"
                            color={getQualityTone(dataQuality?.status)}
                            label={`${dataQuality?.score ?? 0}/100`}
                          />
                        }
                      />
                      {(dataQuality?.checks ?? []).map((check) => (
                        <SoftRow
                          key={check.key}
                          label={qualityCheckLabel(check.key)}
                          value={
                            <Chip
                              size="small"
                              color={getSeverityTone(check.severity)}
                              label={check.value}
                            />
                          }
                        />
                      ))}
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="تنبيهات الانحراف"
                  eyebrow={`عتبة ${anomalyReport?.thresholdPercent ?? 25}%`}
                  icon={overviewIcon(stockAlertAnimation, 'تنبيهات الانحراف', tones.risk)}
                >
                  {qualityLoading ? (
                    <LoadingBlock />
                  ) : (anomalyReport?.alerts.length ?? 0) === 0 ? (
                    <EmptyState text="لا توجد انحرافات تتجاوز العتبة المحددة." />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>المؤشر</TableCell>
                            <TableCell align="center">السابق</TableCell>
                            <TableCell align="center">الحالي</TableCell>
                            <TableCell align="right">الانحراف</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(anomalyReport?.alerts ?? []).map((alert) => (
                            <TableRow key={alert.key} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                  {anomalyKeyLabel(alert.key)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {alert.severity === 'critical' ? 'حرج' : 'تحذير'}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">{alert.previousValue.toFixed(2)}</TableCell>
                              <TableCell align="center">{alert.currentValue.toFixed(2)}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  color: alert.deltaPercent < 0 ? 'error.main' : 'success.main',
                                  fontWeight: 900,
                                }}
                              >
                                {formatPercent(alert.deltaPercent)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SectionCard>
              </Box>
            </SectionBand>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <SectionCard
                title="معلومات المتجر"
                icon={overviewIcon(storeAnimation, 'معلومات المتجر')}
              >
                <Stack spacing={1.25}>
                  <SoftRow
                    label="معرّف المتجر (Store ID)"
                    value={
                      <Typography dir="ltr" sx={{ fontFamily: 'monospace', fontWeight: 900 }}>
                        {session.user.storeId}
                      </Typography>
                    }
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                    {session.user.permissions.length > 0 ? (
                      session.user.permissions.map((perm) => (
                        <Chip key={perm} size="small" label={perm} color="primary" />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        لا توجد صلاحيات مخصصة
                      </Typography>
                    )}
                  </Box>
                  <SoftRow label="عملة التقارير" value={currencyCode} />
                </Stack>
              </SectionCard>

              <SectionCard
                title="دليل الاستخدام السريع"
                icon={overviewIcon(dashboardAnimation, 'دليل الاستخدام السريع')}
              >
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    paddingInlineStart: 2.4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.1,
                    color: 'text.secondary',
                    '& li': { pl: 0.5 },
                  }}
                >
                  {[
                    'قم بضبط إعدادات المتجر الأساسية (العملة، سياسات الشحن).',
                    'أضف تصنيفات المنتجات لتنظيم متجرك.',
                    'أضف منتجاتك الأولى وحدد أسعارها ومخزونها.',
                    'تأكد من ضبط طرق الشحن والدفع.',
                    'اختر واجهة مناسبة (Theme) لمتجرك.',
                    'اربط نطاقك الخاص (Domain) لانطلاقة احترافية.',
                  ].map((item) => (
                    <Box component="li" key={item}>
                      <Typography variant="body2" sx={{ fontSize: '0.92rem', fontWeight: 650 }}>
                        {item}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </SectionCard>
            </Box>
          </>
        )}
      </Box>
    </AppPage>
  );
}

function getQualityTone(status: 'healthy' | 'warning' | 'critical' | undefined): ChipTone {
  if (status === 'critical') return 'error';
  if (status === 'warning') return 'warning';
  return 'success';
}

function getSeverityTone(severity: 'ok' | 'warning' | 'critical'): ChipTone {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  return 'success';
}
