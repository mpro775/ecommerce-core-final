import {
  ArrowForwardIcon,
  CheckCircleIcon,
  DashboardIcon,
  LanguageIcon,
  PlayCircleOutlineIcon,
  RocketLaunchIcon,
} from '../../../components/icons';
import { Box, Button, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';

interface MarketingFinalCtaProps {
  onCreateAccount: () => void;
  onSignIn: () => void;
}

export function MarketingFinalCta({ onCreateAccount, onSignIn }: MarketingFinalCtaProps) {
  const theme = useTheme();
  const { content, locale } = useMarketingLocale();
  const finalCta = content.finalCta;

  return (
    <Box
      component="section"
      id="final-cta"
      data-mascot-anchor="end"
      data-mascot-scene="final-cta"
      data-marketing-snap-scene="true"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <RevealOnScroll>
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: ADMIN_TOKENS.radius.hero,
              color: 'white',
              py: { xs: 7, md: 9 },
              px: { xs: 2.5, md: 6 },
              background:
                theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, #17181B 0%, ${alpha(theme.palette.primary.main, 0.46)} 64%, ${alpha(theme.palette.secondary.main, 0.34)} 130%)`
                  : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 58%, ${theme.palette.secondary.main} 135%)`,
              boxShadow: ADMIN_TOKENS.elevation.floating,
              border: '1px solid',
              borderColor: alpha('#fff', 0.18),
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                opacity: 0.18,
                backgroundImage:
                  'linear-gradient(to left, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage:
                  'linear-gradient(90deg, transparent 0%, black 25%, black 72%, transparent 100%)',
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: 760,
                mx: 'auto',
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: alpha('#fff', 0.12),
                  display: 'grid',
                  placeItems: 'center',
                  mx: 'auto',
                  mb: 2.5,
                }}
              >
                <RocketLaunchIcon fontSize="large" />
              </Box>
              <Typography
                variant="h2"
                sx={{
                  mb: 2,
                  fontSize: { xs: '2.1rem', md: '3.15rem' },
                  fontWeight: 900,
                  lineHeight: 1.18,
                }}
              >
                {finalCta.title}
              </Typography>
              <Typography
                variant="h6"
                sx={{ mb: 4, color: alpha('#fff', 0.82), fontWeight: 500, lineHeight: 1.75 }}
              >
                {finalCta.description}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                  gap: 1,
                  mb: 4,
                }}
              >
                {finalCta.cards.map((item, index) => {
                  const icons = [
                    <DashboardIcon fontSize="small" />,
                    <CheckCircleIcon fontSize="small" />,
                    <LanguageIcon fontSize="small" />,
                    <RocketLaunchIcon fontSize="small" />,
                  ];
                  return (
                  <Box
                    key={item.label}
                    sx={{
                      minHeight: 92,
                      p: 1.4,
                      borderRadius: 1.2,
                      border: '1px solid',
                      borderColor: alpha('#fff', 0.18),
                      bgcolor: alpha('#fff', 0.09),
                      backdropFilter: 'blur(14px)',
                    }}
                  >
                    <Box sx={{ color: alpha('#fff', 0.92), mb: 0.9 }}>{icons[index]}</Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 900 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha('#fff', 0.72), fontWeight: 700 }}>
                      {item.caption}
                    </Typography>
                  </Box>
                  );
                })}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={onCreateAccount}
                  endIcon={<ArrowForwardIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : 'none' }} />}
                  sx={{
                    background: 'white',
                    color: 'primary.dark',
                    minHeight: 50,
                    px: 4,
                    '&:hover': { background: alpha('#fff', 0.9) },
                  }}
                >
                  {finalCta.primaryCta}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={onSignIn}
                  startIcon={<PlayCircleOutlineIcon />}
                  sx={{
                    color: 'white',
                    borderColor: alpha('#fff', 0.34),
                    minHeight: 50,
                    px: 4,
                    '&:hover': { borderColor: 'white', bgcolor: alpha('#fff', 0.1) },
                  }}
                >
                  {finalCta.secondaryCta}
                </Button>
              </Stack>
            </Box>
          </Box>
        </RevealOnScroll>
      </Container>
    </Box>
  );
}
