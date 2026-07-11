import { Box, IconButton, Tooltip, alpha, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { ExpandLess } from '../../components/icons';
import { MarketingHero } from './components/marketing-hero';
import { MarketingMascotJourney } from './components/marketing-mascot-journey';
import { MarketingNavbar } from './components/marketing-navbar';
import { MarketingSections } from './components/marketing-sections';
import type { MarketingLocale } from './marketing-content';
import { MarketingLocaleProvider, useMarketingLocale } from './marketing-locale-context';

interface MarketingHomeProps {
  locale: MarketingLocale;
  themeMode: 'light' | 'dark';
  onCreateAccount: () => void;
  onSignIn: () => void;
  onToggleLocale: () => void;
  onToggleThemeMode: (origin?: { x: number; y: number }) => void;
}

function MarketingHomeContent({
  themeMode,
  onCreateAccount,
  onSignIn,
  onToggleLocale,
  onToggleThemeMode,
}: Omit<MarketingHomeProps, 'locale'>) {
  const theme = useTheme();
  const { content, direction, locale } = useMarketingLocale();
  const [isBackToTopVisible, setIsBackToTopVisible] = useState(false);
  const [isBackToTopTooltipOpen, setIsBackToTopTooltipOpen] = useState(false);

  useEffect(() => {
    function handleScroll(): void {
      const isVisible = window.scrollY > 560;
      setIsBackToTopVisible(isVisible);
      if (!isVisible) {
        setIsBackToTopTooltipOpen(false);
      }
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  function trackAndCreateAccount(source: string): void {
    window.dispatchEvent(
      new CustomEvent('ecommerce_core:cta', {
        detail: { page: 'marketing', action: 'create-account', source },
      }),
    );
    onCreateAccount();
  }

  function trackAndSignIn(source: string): void {
    window.dispatchEvent(
      new CustomEvent('ecommerce_core:cta', {
        detail: { page: 'marketing', action: 'sign-in', source },
      }),
    );
    onSignIn();
  }

  function scrollToTop(): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = prefersReducedMotion ? 'auto' : 'smooth';
    setIsBackToTopVisible(false);
    setIsBackToTopTooltipOpen(false);
    window.scrollTo({ top: 0, behavior });
    document.documentElement.scrollTo({ top: 0, behavior });
  }

  return (
    <Box
      component="div"
      dir={direction}
      lang={locale}
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.025)} 0%, ${theme.palette.background.default} 34%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`
            : `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.light, 0.16)} 34%, #f8fbfc 100%)`,
      }}
    >
      <MarketingNavbar
        locale={locale}
        themeMode={themeMode}
        onCreateAccount={() => trackAndCreateAccount('navbar')}
        onSignIn={() => trackAndSignIn('navbar')}
        onToggleLocale={onToggleLocale}
        onToggleThemeMode={onToggleThemeMode}
      />
      <MarketingMascotJourney />

      <Box data-marketing-journey="true">
        <MarketingHero
          onCreateAccount={() => trackAndCreateAccount('hero-primary')}
          onSignIn={() => trackAndSignIn('hero-secondary')}
        />

        <MarketingSections
          onCreateAccount={() => trackAndCreateAccount('section-cta')}
          onSignIn={() => trackAndSignIn('section-signin')}
        />
      </Box>

      <Tooltip
        title={content.home.backToTopTitle}
        placement={direction === 'rtl' ? 'right' : 'left'}
        open={isBackToTopVisible && isBackToTopTooltipOpen}
      >
        <IconButton
          aria-label={content.home.backToTopAria}
          onBlur={() => setIsBackToTopTooltipOpen(false)}
          onClick={scrollToTop}
          onFocus={() => setIsBackToTopTooltipOpen(true)}
          onMouseEnter={() => setIsBackToTopTooltipOpen(true)}
          onMouseLeave={() => setIsBackToTopTooltipOpen(false)}
          sx={{
            position: 'fixed',
            insetInlineStart: { xs: 18, md: 28 },
            bottom: { xs: 20, md: 28 },
            zIndex: 45,
            width: { xs: 44, md: 50 },
            height: { xs: 44, md: 50 },
            border: '1px solid',
            borderColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.14)
                : alpha(theme.palette.primary.main, 0.16),
            bgcolor:
              theme.palette.mode === 'dark'
                ? alpha('#17181D', 0.9)
                : alpha(theme.palette.background.paper, 0.88),
            color: 'primary.main',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 16px 34px rgba(0,0,0,0.28)'
                : '0 16px 34px rgba(80,46,145,0.16)',
            opacity: isBackToTopVisible ? 1 : 0,
            pointerEvents: isBackToTopVisible ? 'auto' : 'none',
            transform: isBackToTopVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 14px, 0)',
            transition: 'opacity 180ms ease, transform 180ms ease, background-color 180ms ease',
            backdropFilter: 'blur(18px)',
            '&:hover': {
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.1)
                  : alpha(theme.palette.primary.light, 0.32),
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              transform: 'none',
            },
          }}
        >
          <ExpandLess fontSize="medium" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function MarketingHome({ locale, ...props }: MarketingHomeProps) {
  return (
    <MarketingLocaleProvider locale={locale}>
      <MarketingHomeContent {...props} />
    </MarketingLocaleProvider>
  );
}
