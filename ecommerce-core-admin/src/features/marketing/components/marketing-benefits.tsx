import { CheckCircleIcon, DashboardIcon, TrendingUpIcon, VerifiedUserIcon } from '../../../components/icons';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMetricCard, MarketingMiniChart } from './marketing-visuals';

const metricIcons = [TrendingUpIcon, DashboardIcon, CheckCircleIcon, VerifiedUserIcon];

export function MarketingBenefits() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const benefits = content.benefits;

  return (
    <MarketingSectionShell
      id="benefits"
      mascotAnchor="start"
      mascotScene="benefits"
      eyebrow={benefits.eyebrow}
      title={benefits.title}
      description={benefits.description}
      surface="paper"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 0.95fr' },
          gap: 2,
          mb: { xs: 3, md: 4 },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)', lg: 'repeat(2, 1fr)' }, gap: 1.1 }}>
          {benefits.metrics.map((item, index) => {
            const Icon = metricIcons[index % metricIcons.length] ?? TrendingUpIcon;
            return (
              <MarketingMetricCard
                key={item.label}
                label={item.label}
                value={item.value}
                caption={item.caption}
                tone={item.tone}
                icon={<Icon fontSize="small" />}
              />
            );
          })}
        </Box>
        <RevealOnScroll delay={120}>
          <Box
            sx={{
              height: '100%',
              minHeight: 260,
              p: { xs: 2, md: 2.4 },
              borderRadius: 1.4,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.48 : 0.68),
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
              {benefits.quickTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 1.4 }}>
              {benefits.quickDescription}
            </Typography>
            <Box sx={{ height: 168 }}>
              <MarketingMiniChart type="bar" data={benefits.chartData} color={theme.palette.primary.main} />
            </Box>
          </Box>
        </RevealOnScroll>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 1.4,
        }}
      >
        {benefits.items.map((item, index) => (
          <RevealOnScroll key={item} delay={(index % 3) * 70}>
            <Box
              sx={{
                alignItems: 'center',
                display: 'flex',
                gap: 1.4,
                minHeight: 86,
                p: 1.8,
                borderRadius: 1.2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(
                  theme.palette.background.default,
                  theme.palette.mode === 'dark' ? 0.5 : 0.68,
                ),
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.1,
                  bgcolor: alpha(theme.palette.success.main, 0.11),
                  color: 'success.main',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <TrendingUpIcon fontSize="small" />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {item}
              </Typography>
            </Box>
          </RevealOnScroll>
        ))}
      </Box>
    </MarketingSectionShell>
  );
}
