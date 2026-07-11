import {
  ArrowForwardIcon,
  CheckCircleOutlineIcon,
  PlayCircleOutlineIcon,
  RocketLaunchIcon,
} from '../../../components/icons';
import { Box, Button, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import { EcommerceCorePatternLayer } from '../../../components/ecommerce_core-pattern-layer';
import { useMarketingLocale } from '../marketing-locale-context';
import { CommerceCommandCenter } from './marketing-product-showcase';
import { RevealOnScroll, getReducedMotionSx, marketingFloat } from './marketing-motion';

interface MarketingHeroProps {
  onCreateAccount: () => void;
  onSignIn: () => void;
}

const ecommerce_core_SHAPE_SRC = '/brand/ecommerce_core-shape-1.png';

export function MarketingHero({ onCreateAccount, onSignIn }: MarketingHeroProps) {
  const theme = useTheme();
  const { content, locale } = useMarketingLocale();
  const hero = content.hero;

  return (
    <Box
      component="section"
      id="hero"
      data-mascot-anchor="start"
      data-mascot-scene="hero"
      data-marketing-snap-scene="true"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        pt: { xs: 14, md: 18 },
        pb: { xs: 6, md: 9 },
        bgcolor: 'background.default',
        backgroundImage:
          theme.palette.mode === 'dark'
            ? `linear-gradient(140deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, transparent 34%), linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.035)} 0%, transparent 58%)`
            : `linear-gradient(140deg, ${alpha(theme.palette.primary.light, 0.72)} 0%, transparent 34%), linear-gradient(180deg, ${alpha(theme.palette.secondary.light, 0.5)} 0%, transparent 58%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          opacity: theme.palette.mode === 'dark' ? 0.18 : 0.32,
          backgroundImage:
            'linear-gradient(to left, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '54px 54px',
          color: theme.palette.mode === 'dark' ? '#FFFFFF' : theme.palette.primary.main,
          maskImage: 'linear-gradient(180deg, black 0%, transparent 76%)',
        },
      }}
    >
      <EcommerceCorePatternLayer
        variant="hero"
        anchor="start"
        opacity={theme.palette.mode === 'dark' ? 0.62 : 0.78}
        sx={{
          insetInlineStart: { xs: '-26%', md: '-10%' },
          insetInlineEnd: { xs: '-30%', md: '-8%' },
          maskImage: 'linear-gradient(180deg, black 0%, black 74%, transparent 100%)',
        }}
      />

      <Box
        component="img"
        src={ecommerce_core_SHAPE_SRC}
        alt=""
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: { xs: 92, md: 118 },
          insetInlineStart: { xs: -72, md: 26 },
          width: { xs: 150, md: 210 },
          opacity: theme.palette.mode === 'dark' ? 0.18 : 0.22,
          animation: `${marketingFloat} 7s ease-in-out infinite`,
          ...getReducedMotionSx(),
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
            gap: { xs: 5, md: 7 },
            alignItems: 'center',
          }}
        >
          <RevealOnScroll>
            <Box sx={{ maxWidth: 690 }}>
              <Typography
                component="div"
                sx={{
                  alignItems: 'center',
                  bgcolor: alpha(theme.palette.background.paper, 0.74),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.16),
                  borderRadius: 999,
                  boxShadow: ADMIN_TOKENS.elevation.xs,
                  color: 'primary.main',
                  display: 'inline-flex',
                  fontWeight: 900,
                  gap: 1,
                  mb: 2.6,
                  px: 1.7,
                  py: 0.9,
                }}
              >
                <RocketLaunchIcon fontSize="small" />
                {hero.eyebrow}
              </Typography>

              <Typography
                variant="h1"
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: '2.65rem', sm: '3.25rem', md: '4.25rem' },
                  lineHeight: 1.08,
                  mb: 2.4,
                  maxWidth: 760,
                }}
              >
                {hero.title}
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '1.06rem', md: '1.22rem' },
                  fontWeight: 500,
                  lineHeight: 1.8,
                  mb: 3.2,
                  maxWidth: 640,
                }}
              >
                {hero.description}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.8 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={onCreateAccount}
                  endIcon={<ArrowForwardIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : 'none' }} />}
                  sx={{ minHeight: 50, px: 3.4, fontSize: '1rem' }}
                >
                  {hero.primaryCta}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={onSignIn}
                  startIcon={<PlayCircleOutlineIcon />}
                  sx={{
                    minHeight: 50,
                    px: 3.2,
                    bgcolor: alpha(theme.palette.background.paper, 0.68),
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {hero.secondaryCta}
                </Button>
              </Stack>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, mb: 4 }}>
                {hero.checks.map((item) => (
                  <Box
                    key={item}
                    sx={{
                      alignItems: 'center',
                      color: 'text.secondary',
                      display: 'inline-flex',
                      gap: 0.8,
                      fontWeight: 800,
                    }}
                  >
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {item}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(3, 1fr)',
                    sm: 'repeat(3, minmax(120px, 1fr))',
                  },
                  gap: 1.2,
                  maxWidth: 560,
                }}
              >
                {hero.stats.map((stat) => (
                  <Box
                    key={stat.label}
                    sx={{
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, 0.14),
                      borderRadius: 1.2,
                      bgcolor: alpha(theme.palette.background.paper, 0.62),
                      p: { xs: 1.2, sm: 1.5 },
                    }}
                  >
                    <Typography
                      variant="h5"
                      sx={{ color: 'primary.main', fontWeight: 900, lineHeight: 1 }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </RevealOnScroll>

          <RevealOnScroll delay={140}>
            <CommerceCommandCenter />
          </RevealOnScroll>
        </Box>

        <RevealOnScroll delay={220}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1,
              mt: { xs: 5, md: 7 },
            }}
          >
            {hero.trustSignals.map((signal) => (
              <Box
                key={signal.label}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.2,
                  bgcolor: alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === 'dark' ? 0.5 : 0.7,
                  ),
                  p: 1.5,
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ color: 'text.primary', fontWeight: 900, direction: 'ltr' }}
                >
                  {signal.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {signal.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </RevealOnScroll>
      </Container>
    </Box>
  );
}
