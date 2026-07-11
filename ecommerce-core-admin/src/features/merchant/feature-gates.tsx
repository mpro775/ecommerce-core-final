import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AnalyticsIcon, ArrowForwardIcon, BlockIcon } from '../../components/icons';
import type { MerchantRequester } from './merchant-dashboard.types';

export type FeatureKey =
  | 'custom_domains'
  | 'advanced_promotions'
  | 'priority_support'
  | 'advanced_analytics'
  | 'api_access'
  | 'webhooks_access'
  | 'staff_management'
  | 'affiliate_program'
  | 'loyalty_program';

export interface LockedFeatureConfig {
  featureKey: FeatureKey;
  title: string;
  description: string;
  includedInPlanLabel: string;
  previewItems: Array<{
    label: string;
    value: string;
    hint: string;
  }>;
}

interface FeatureGateState {
  loading: boolean;
  error: string;
  isEnabled: boolean;
  isLocked: boolean;
  lockedFeatureKey: FeatureKey | null;
  lockedDisplayName: string;
}

const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  custom_domains: 'Custom Domains',
  advanced_promotions: 'Advanced Promotions',
  priority_support: 'Priority Support',
  advanced_analytics: 'Advanced Analytics',
  api_access: 'API Access',
  webhooks_access: 'Webhooks Access',
  staff_management: 'Staff Management',
  affiliate_program: 'Affiliate Program',
  loyalty_program: 'Loyalty Program',
};

export const ADVANCED_ANALYTICS_LOCKED_CONFIG: LockedFeatureConfig = {
  featureKey: 'advanced_analytics',
  title: 'التحليلات المتقدمة',
  description:
    'افتح قراءة أوضح للمبيعات، التحويل، العملاء، المخزون، جودة البيانات والتنبيهات حتى تعرف أين تتحسن وأين تخسر فرصًا.',
  includedInPlanLabel: 'متاح في باقة Pro وما فوق',
  previewItems: [
    {
      label: 'قمع التحويل',
      value: 'زيارة → سلة → دفع',
      hint: 'اعرف أين يخرج العملاء قبل إتمام الطلب.',
    },
    {
      label: 'صحة المخزون',
      value: '12 منتج يحتاج متابعة',
      hint: 'اكتشف المنتجات بطيئة الحركة ومخاطر نفاد المخزون.',
    },
    {
      label: 'تنبيهات الانحراف',
      value: '-18% في قبول الدفع',
      hint: 'راقب التغيرات غير الطبيعية قبل أن تتحول لمشكلة.',
    },
  ],
};

export const ANALYTICS_LOCKED_PREVIEW_CARDS = [
  {
    title: 'مبيعات وطلبات أوضح',
    description: 'شاهد المنتجات الأعلى أداءً، حالات الطلب، ومتوسط قيمة الطلب خلال الفترة المحددة.',
    previewItems: [
      { label: 'إجمالي المبيعات', value: '1,240,000 YER', hint: 'مثال توضيحي' },
      { label: 'أكثر منتج مبيعًا', value: 'باقة العناية', hint: 'مثال توضيحي' },
      { label: 'نسبة الإلغاء', value: '3.8%', hint: 'مثال توضيحي' },
    ],
  },
  {
    title: 'المخزون والعملاء',
    description: 'افهم المنتجات التي تحتاج إعادة تموين والعملاء الأكثر تكرارًا في الشراء.',
    previewItems: [
      { label: 'منتجات منخفضة المخزون', value: '7', hint: 'مثال توضيحي' },
      { label: 'عملاء عائدون', value: '42', hint: 'مثال توضيحي' },
      { label: 'معدل إعادة الشراء', value: '26.4%', hint: 'مثال توضيحي' },
    ],
  },
  {
    title: 'التحويل وجودة البيانات',
    description: 'اعرف مصدر الزيارات الأفضل وتابع جودة البيانات والتنبيهات المهمة.',
    previewItems: [
      { label: 'تحويل الزيارة إلى دفع', value: '8.2%', hint: 'مثال توضيحي' },
      { label: 'أفضل مصدر زيارات', value: 'Instagram', hint: 'مثال توضيحي' },
      { label: 'درجة جودة البيانات', value: '91/100', hint: 'مثال توضيحي' },
    ],
  },
];

const initialGateState: FeatureGateState = {
  loading: true,
  error: '',
  isEnabled: false,
  isLocked: false,
  lockedFeatureKey: null,
  lockedDisplayName: '',
};

export function useFeatureGate(request: MerchantRequester, featureKey: FeatureKey): FeatureGateState {
  void request;
  const [state, setState] = useState<FeatureGateState>(() => {
    const isEnabled = featureKey !== 'custom_domains';
    return {
      loading: false,
      error: '',
      isEnabled,
      isLocked: !isEnabled,
      lockedFeatureKey: isEnabled ? null : featureKey,
      lockedDisplayName: isEnabled ? '' : FEATURE_DISPLAY_NAMES[featureKey],
    };
  });

  useEffect(() => {
    const isEnabled = featureKey !== 'custom_domains';
    setState({
      loading: false,
      error: '',
      isEnabled,
      isLocked: !isEnabled,
      lockedFeatureKey: isEnabled ? null : featureKey,
      lockedDisplayName: isEnabled ? '' : FEATURE_DISPLAY_NAMES[featureKey],
    });
  }, [featureKey, request]);

  return state;
}
export function buildFeatureUpgradeHref(featureKey: FeatureKey): string {
  const fallback = `/merchant?tab=store&feature=${featureKey}`;
  if (typeof window === 'undefined') {
    return fallback;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('tab', 'store');
  url.searchParams.set('feature', featureKey);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function LockedFeaturePreviewCard({
  config,
  title,
  description,
  previewItems,
}: {
  config: LockedFeatureConfig;
  title?: string;
  description?: string;
  previewItems?: LockedFeatureConfig['previewItems'];
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const items = previewItems ?? config.previewItems;
  const upgradeHref = useMemo(() => buildFeatureUpgradeHref(config.featureKey), [config.featureKey]);

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        p: { xs: 2, md: 2.35 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2),
        bgcolor: isDark ? alpha(theme.palette.common.white, 0.055) : alpha(theme.palette.common.white, 0.72),
        boxShadow: isDark ? '0 18px 38px rgba(0,0,0,0.2)' : '0 18px 38px rgba(80,46,145,0.08)',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.1} alignItems="center">
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
              flexShrink: 0,
            }}
          >
            <AnalyticsIcon />
          </Box>
          <Box minWidth={0}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {title ?? config.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650, lineHeight: 1.7 }}>
              {description ?? config.description}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ position: 'relative', minHeight: 170 }}>
          <Stack spacing={1} sx={{ filter: 'blur(1.1px)', opacity: 0.44, pointerEvents: 'none' }}>
            {items.map((item) => (
              <Box
                key={`${item.label}-${item.value}`}
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.divider, 0.8),
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.28 : 0.62),
                }}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" sx={{ fontWeight: 850 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" color="primary.main" sx={{ fontWeight: 900 }}>
                    {item.value}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {item.hint}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1.25,
            }}
          >
            <Stack
              spacing={1.25}
              alignItems="center"
              sx={{
                maxWidth: 360,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2.5,
                textAlign: 'center',
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.24),
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.86),
                boxShadow: isDark ? '0 16px 28px rgba(0,0,0,0.24)' : '0 16px 28px rgba(80,46,145,0.12)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Chip size="small" color="primary" icon={<BlockIcon />} label={config.includedInPlanLabel} />
              <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.7 }}>
                هذه معاينة توضيحية لما سيظهر عند تفعيل التحليلات المتقدمة.
              </Typography>
              <Button
                href={upgradeHref}
                variant="contained"
                size="small"
                endIcon={<ArrowForwardIcon />}
                sx={{ fontWeight: 900 }}
              >
                عرض الباقات
              </Button>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}

export function LockedFeaturePage({
  config = ADVANCED_ANALYTICS_LOCKED_CONFIG,
  cards = ANALYTICS_LOCKED_PREVIEW_CARDS,
}: {
  config?: LockedFeatureConfig;
  cards?: Array<{
    title: string;
    description: string;
    previewItems: LockedFeatureConfig['previewItems'];
  }>;
}) {
  return (
    <Stack spacing={2.25}>
      <LockedFeaturePreviewCard config={config} />
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {cards.map((card) => (
          <LockedFeaturePreviewCard
            key={card.title}
            config={config}
            title={card.title}
            description={card.description}
            previewItems={card.previewItems}
          />
        ))}
      </Box>
    </Stack>
  );
}
