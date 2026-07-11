import { CheckIcon } from '../../../components/icons';
import { Box, Button, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMiniChart } from './marketing-visuals';

export function MarketingPricing() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const pricing = content.pricing;

  return (
    <MarketingSectionShell
      id="pricing"
      mascotAnchor="end"
      mascotScene="pricing"
      eyebrow={pricing.eyebrow}
      title={pricing.title}
      description={pricing.description}
      surface="paper"
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.6, alignItems: 'stretch' }}>
        {pricing.plans.map((plan, index) => {
          const isPopular = index === 1;
          const price = pricing.prices[index] ?? pricing.prices[0];

          return (
            <RevealOnScroll key={plan.name} delay={index * 90}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 2.3, md: 2.8 },
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: isPopular ? alpha(theme.palette.primary.main, 0.5) : 'divider',
                  bgcolor: isPopular ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.075) : alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.48 : 0.65),
                  boxShadow: isPopular
                    ? theme.palette.mode === 'dark'
                      ? '0 18px 40px rgba(0,0,0,0.22)'
                      : '0 18px 40px rgba(80,46,145,0.12)'
                    : 'none',
                  position: 'relative',
                }}
              >
                {isPopular ? (
                  <Chip label={pricing.popularLabel} color="primary" sx={{ mb: 2, fontWeight: 900 }} />
                ) : null}
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.6 }}>
                  {plan.name}
                </Typography>
                <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 900, mb: 1 }}>
                  {plan.subtitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: 68, lineHeight: 1.7, mb: 2 }}>
                  {plan.description}
                </Typography>
                <Box sx={{ mb: 2.4 }}>
                  <Typography variant="h3" component="span" sx={{ fontWeight: 900 }}>
                    {price}
                  </Typography>
                  {index !== 0 ? (
                    <Typography component="span" color="text.secondary" sx={{ fontWeight: 800, mr: 1 }}>
                      {pricing.monthlySuffix}
                    </Typography>
                  ) : null}
                </Box>
                <Button variant={isPopular ? 'contained' : 'outlined'} fullWidth size="large" sx={{ mb: 2.5 }}>
                  {index === 0 ? pricing.startFree : pricing.subscribe}
                </Button>
                <Stack spacing={1.35}>
                  {plan.items.map((item) => (
                    <Stack key={item} direction="row" spacing={1} alignItems="center">
                      <CheckIcon color="success" fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {item}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </RevealOnScroll>
          );
        })}
      </Box>

      <RevealOnScroll delay={180}>
        <Box
          sx={{
            mt: { xs: 3, md: 4 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.12fr 0.88fr' },
            gap: 1.6,
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.4,
              overflow: 'hidden',
              bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.68),
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1.2fr repeat(3, 0.7fr)',
                gap: 0,
                px: { xs: 1.2, md: 1.8 },
                py: 1.2,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              }}
            >
              {[pricing.capabilityHeader, 'Starter', 'Pro', 'Business'].map((item) => (
                <Typography key={item} variant="caption" sx={{ fontWeight: 900, color: item === 'Pro' ? 'primary.main' : 'text.secondary' }}>
                  {item}
                </Typography>
              ))}
            </Box>
            {pricing.capabilityRows.map((row) => (
              <Box
                key={row.capability}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr repeat(3, 0.7fr)',
                  gap: 0,
                  alignItems: 'center',
                  px: { xs: 1.2, md: 1.8 },
                  py: 1.15,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                  {row.capability}
                </Typography>
                {[row.starter, row.pro, row.business].map((enabled, index) => (
                  <Box key={`${row.capability}-${index}`} sx={{ color: enabled ? 'success.main' : 'text.disabled' }}>
                    {enabled ? <CheckIcon fontSize="small" /> : '-'}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              minHeight: 260,
              p: { xs: 2, md: 2.4 },
              borderRadius: 1.4,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.045),
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
              {pricing.growthTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mb: 1.4 }}>
              {pricing.growthDescription}
            </Typography>
            <Box sx={{ height: 170 }}>
              <MarketingMiniChart data={pricing.growthData} color={theme.palette.primary.main} />
            </Box>
          </Box>
        </Box>
      </RevealOnScroll>
    </MarketingSectionShell>
  );
}
