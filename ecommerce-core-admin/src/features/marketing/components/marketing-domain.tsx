import { CheckCircleIcon, LanguageIcon } from '../../../components/icons';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll, marketingPulseLine } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMetricCard } from './marketing-visuals';

export function MarketingDomain() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const domain = content.domain;

  return (
    <MarketingSectionShell
      id="domain"
      mascotAnchor="end"
      mascotScene="domain"
      eyebrow={domain.eyebrow}
      title={domain.title}
      description={domain.description}
      surface="paper"
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.92fr 1.08fr' }, gap: 3.5, alignItems: 'center' }}>
        <RevealOnScroll>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.3 }}>
            {domain.points.map((point, index) => (
              <Box
                key={point}
                sx={{
                  p: 1.7,
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.success.main, 0.18),
                  bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.07 : 0.055),
                }}
              >
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 900 }}>
                  {point}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {domain.stepLabel} {index + 1} {domain.stepSuffix}
                </Typography>
              </Box>
            ))}
          </Box>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <Box
            sx={{
              p: { xs: 2.2, md: 3 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.52 : 0.7),
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 64,
                insetInlineStart: '13%',
                width: '74%',
                height: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.16),
                '&::after': {
                  animation: `${marketingPulseLine} 4s ease-in-out infinite`,
                  bgcolor: theme.palette.secondary.main,
                  content: '""',
                  height: '100%',
                  insetInlineStart: 0,
                  position: 'absolute',
                  top: 0,
                  width: '44%',
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                },
              }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.3, position: 'relative', zIndex: 1 }}>
              {domain.timelineSteps.map((step, index) => (
                <Box key={step} sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: { xs: 58, md: 72 },
                      height: { xs: 58, md: 72 },
                      mx: 'auto',
                      mb: 1.4,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: index === 2 ? alpha(theme.palette.success.main, 0.14) : alpha(theme.palette.primary.main, 0.1),
                      color: index === 2 ? 'success.main' : 'primary.main',
                      border: '1px solid',
                      borderColor: index === 2 ? alpha(theme.palette.success.main, 0.28) : alpha(theme.palette.primary.main, 0.2),
                    }}
                  >
                    {index === 2 ? <CheckCircleIcon /> : <LanguageIcon />}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Stack spacing={1.2} sx={{ mt: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: 1.2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', direction: 'ltr', textAlign: 'left' }}>
                <Typography variant="caption" sx={{ color: 'success.main', fontFamily: 'monospace', fontWeight: 900 }}>
                  https://www.yourbrand.com
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {domain.body}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                <MarketingMetricCard
                  label={domain.metrics[0].label}
                  value={domain.metrics[0].value}
                  caption={domain.metrics[0].caption}
                  tone={domain.metrics[0].tone}
                  icon={<CheckCircleIcon fontSize="small" />}
                />
                <MarketingMetricCard
                  label={domain.metrics[1].label}
                  value={domain.metrics[1].value}
                  caption={domain.metrics[1].caption}
                  tone={domain.metrics[1].tone}
                  icon={<LanguageIcon fontSize="small" />}
                />
              </Box>
            </Stack>
          </Box>
        </RevealOnScroll>
      </Box>
    </MarketingSectionShell>
  );
}
