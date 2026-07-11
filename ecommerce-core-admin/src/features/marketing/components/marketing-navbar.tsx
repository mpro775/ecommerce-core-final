import {
  ArrowForwardIcon,
  DarkModeOutlinedIcon,
  LanguageIcon,
  LightModeOutlinedIcon,
  LoginRoundedIcon,
  MenuRoundedIcon,
  RocketLaunchIcon,
} from '../../../components/icons';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Button, Container, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import type { MarketingLocale } from '../marketing-content';
import { useMarketingLocale } from '../marketing-locale-context';

interface MarketingNavbarProps {
  locale: MarketingLocale;
  themeMode: 'light' | 'dark';
  onCreateAccount: () => void;
  onSignIn: () => void;
  onToggleLocale: () => void;
  onToggleThemeMode: (origin: { x: number; y: number }) => void;
}

const ecommerce_core_LOGO_SRC = '/brand/ecommerce_core-logo.png';
const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

export function MarketingNavbar({
  locale,
  themeMode,
  onCreateAccount,
  onSignIn,
  onToggleLocale,
  onToggleThemeMode,
}: MarketingNavbarProps) {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const navLinks = content.nav.links;
  const isDark = theme.palette.mode === 'dark';
  const sectionIds = useMemo(() => navLinks.map((item) => item.href.replace('#', '')), [navLinks]);
  const [activeSection, setActiveSection] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function resolveActiveSection(): string {
      const offset = 130;
      const currentY = window.scrollY + offset;
      let currentSection = '';

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && currentY >= section.offsetTop) {
          currentSection = id;
        }
      });

      return currentSection;
    }

    function handleScroll(): void {
      setIsScrolled(window.scrollY > 18);
      setActiveSection(resolveActiveSection());
      if (window.scrollY > 18) {
        setMobileMenuOpen(false);
      }
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sectionIds]);

  function navigateToSection(event: MouseEvent<HTMLElement>, href: string): void {
    event.preventDefault();
    const id = href.replace('#', '');
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
    setMobileMenuOpen(false);
  }

  function handleToggleThemeMode(event: MouseEvent<HTMLButtonElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    onToggleThemeMode({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  function handleToggleLocale(): void {
    onToggleLocale();
    setMobileMenuOpen(false);
  }

  const shellBackground = isDark
    ? alpha('#16171D', isScrolled ? 0.88 : 0.7)
    : alpha('#FFFFFF', isScrolled ? 0.88 : 0.68);

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        px: { xs: 1.4, md: 0 },
        py: { xs: 1.1, md: isScrolled ? 1.1 : 1.55 },
        transition: 'padding 220ms ease, transform 220ms ease',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Container maxWidth="lg" disableGutters sx={{ px: { xs: 0, md: 2 } }}>
        <Box
          sx={{
            alignItems: 'center',
            backdropFilter: 'blur(26px) saturate(150%)',
            background: shellBackground,
            border: '1px solid',
            borderColor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.12)
                : alpha(theme.palette.primary.main, 0.12),
            borderRadius: { xs: 3, md: 999 },
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 22px 54px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 22px 54px rgba(80,46,145,0.12), inset 0 1px 0 rgba(255,255,255,0.84)',
            display: 'grid',
            gap: { xs: 1, md: 1.5 },
            gridTemplateColumns: { xs: 'auto 1fr auto', md: 'auto 1fr auto' },
            minHeight: { xs: 58, md: 72 },
            overflow: 'visible',
            px: { xs: 1.1, md: 1.3 },
            position: 'relative',
          }}
        >
          <Stack
            direction="row"
            spacing={1.1}
            alignItems="center"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setMobileMenuOpen(false);
            }}
            sx={{
              cursor: 'pointer',
              minWidth: 0,
              borderRadius: 999,
              px: { xs: 0.3, md: 1 },
              py: 0.4,
            }}
          >
            <Box
              sx={{
                display: { xs: 'grid', md: 'none' },
                width: { xs: 42, md: 48 },
                height: { xs: 42, md: 48 },
                borderRadius: { xs: 2, md: '50%' },
                placeItems: 'center',
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.16 : 0.1,
                ),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.16),
              }}
            >
              <Box
                component="img"
                src={ecommerce_core_ICON_SRC}
                alt="Ecommerce Core Store"
                sx={{
                  width: { xs: 31, md: 35 },
                  height: { xs: 31, md: 35 },
                  objectFit: 'contain',
                  filter: `drop-shadow(0 8px 16px ${alpha(theme.palette.primary.main, 0.22)})`,
                }}
              />
            </Box>
            <Box
              component="img"
              src={ecommerce_core_LOGO_SRC}
              alt="Ecommerce Core Store"
              sx={{
                width: { md: 154, lg: 176 },
                height: 'auto',
                objectFit: 'contain',
                display: { xs: 'none', md: 'block' },
                filter:
                  theme.palette.mode === 'dark'
                    ? 'drop-shadow(0 10px 18px rgba(9,7,16,0.34))'
                    : 'none',
              }}
            />
          </Stack>

          <Box
            component="nav"
            aria-label={content.nav.ariaLabel}
            sx={{
              justifySelf: 'center',
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 0.45,
              p: 0.45,
              borderRadius: 999,
              border: '1px solid',
              borderColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.1)
                  : alpha(theme.palette.primary.main, 0.09),
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.035)
                  : alpha(theme.palette.primary.light, 0.28),
            }}
          >
            {navLinks.map((item) => {
              const isActive = activeSection === item.href.replace('#', '');

              return (
                <Box
                  key={item.href}
                  component="a"
                  href={item.href}
                  onClick={(event) => navigateToSection(event, item.href)}
                  sx={{
                    position: 'relative',
                    textDecoration: 'none',
                    color: isActive ? 'primary.main' : 'text.secondary',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    borderRadius: 999,
                    px: { md: 1.45, lg: 1.8 },
                    py: 1,
                    transition:
                      'color 170ms ease, background-color 170ms ease, transform 170ms ease',
                    bgcolor: isActive
                      ? theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.09)
                        : alpha(theme.palette.background.paper, 0.94)
                      : 'transparent',
                    boxShadow: isActive
                      ? theme.palette.mode === 'dark'
                        ? 'inset 0 1px 0 rgba(255,255,255,0.06)'
                        : ADMIN_TOKENS.elevation.xs
                      : 'none',
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.07)
                          : alpha(theme.palette.background.paper, 0.8),
                      transform: 'translateY(-1px)',
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                      transition: 'none',
                      '&:hover': { transform: 'none' },
                    },
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Box>

          <Stack
            direction="row"
            spacing={{ xs: 0.8, md: 1 }}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Button
              variant="text"
              onClick={onSignIn}
              startIcon={<LoginRoundedIcon />}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                color: 'text.primary',
                fontWeight: 900,
                px: 1.4,
              }}
            >
              {content.nav.signIn}
            </Button>
            <Tooltip title={themeMode === 'dark' ? content.nav.themeLight : content.nav.themeDark}>
              <IconButton
                onClick={handleToggleThemeMode}
                aria-label={themeMode === 'dark' ? content.nav.themeLightAria : content.nav.themeDarkAria}
                sx={{
                  width: { xs: 40, md: 44 },
                  height: { xs: 40, md: 44 },
                  border: '1px solid',
                  borderColor: isDark
                    ? alpha(theme.palette.common.white, 0.14)
                    : alpha(theme.palette.primary.main, 0.14),
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.06)
                    : alpha(theme.palette.background.paper, 0.72),
                  color: isDark ? 'primary.main' : 'warning.main',
                  boxShadow: isDark
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 8px 18px rgba(80,46,145,0.08)',
                  '&:hover': {
                    bgcolor: isDark
                      ? alpha(theme.palette.common.white, 0.1)
                      : alpha(theme.palette.primary.light, 0.32),
                    borderColor: isDark
                      ? alpha(theme.palette.common.white, 0.2)
                      : alpha(theme.palette.primary.main, 0.24),
                  },
                }}
              >
                {themeMode === 'dark' ? (
                  <LightModeOutlinedIcon fontSize="small" />
                ) : (
                  <DarkModeOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={content.nav.languageTooltip}>
              <IconButton
                onClick={handleToggleLocale}
                aria-label={content.nav.languageAria}
                sx={{
                  width: { xs: 40, md: 44 },
                  height: { xs: 40, md: 44 },
                  border: '1px solid',
                  borderColor: isDark
                    ? alpha(theme.palette.common.white, 0.14)
                    : alpha(theme.palette.primary.main, 0.14),
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.06)
                    : alpha(theme.palette.background.paper, 0.72),
                  color: isDark ? 'secondary.main' : 'primary.main',
                  boxShadow: isDark
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 8px 18px rgba(80,46,145,0.08)',
                  '&:hover': {
                    bgcolor: isDark
                      ? alpha(theme.palette.common.white, 0.1)
                      : alpha(theme.palette.primary.light, 0.32),
                    borderColor: isDark
                      ? alpha(theme.palette.common.white, 0.2)
                      : alpha(theme.palette.primary.main, 0.24),
                  },
                }}
              >
                <LanguageIcon fontSize="small" />
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    marginInlineStart: 0.25,
                    direction: 'ltr',
                  }}
                >
                  {content.nav.languageButtonLabel}
                </Box>
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              onClick={onCreateAccount}
              endIcon={<ArrowForwardIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : 'none' }} />}
              sx={{
                minHeight: { xs: 40, md: 44 },
                px: { xs: 1.7, md: 2.4 },
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 14px 28px rgba(155,122,230,0.22)'
                    : '0 14px 28px rgba(80,46,145,0.2)',
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {content.nav.createStore}
              </Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                {content.nav.start}
              </Box>
            </Button>
            <IconButton
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label={content.nav.menuAria}
              aria-expanded={mobileMenuOpen}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                width: 40,
                height: 40,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(
                  theme.palette.background.paper,
                  theme.palette.mode === 'dark' ? 0.08 : 0.72,
                ),
              }}
            >
              <MenuRoundedIcon />
            </IconButton>
          </Stack>

          {mobileMenuOpen ? (
            <Box
              sx={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                insetInline: 0,
                mx: 0,
                p: 1,
                borderRadius: 2.4,
                border: '1px solid',
                borderColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.12)
                    : alpha(theme.palette.primary.main, 0.12),
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? alpha('#17181D', 0.96)
                    : alpha(theme.palette.background.paper, 0.96),
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 26px 60px rgba(0,0,0,0.36)'
                    : '0 26px 60px rgba(80,46,145,0.16)',
                backdropFilter: 'blur(24px)',
                display: { xs: 'grid', md: 'none' },
                gap: 0.6,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ px: 1, py: 0.8, color: 'primary.main' }}
              >
                <RocketLaunchIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 900 }}>
                  {content.nav.mobileTitle}
                </Typography>
              </Stack>
              {navLinks.map((item) => {
                const isActive = activeSection === item.href.replace('#', '');

                return (
                  <Box
                    key={item.href}
                    component="a"
                    href={item.href}
                    onClick={(event) => navigateToSection(event, item.href)}
                    sx={{
                      borderRadius: 1.5,
                      color: isActive ? 'primary.main' : 'text.primary',
                      bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                      fontWeight: 900,
                      px: 1.4,
                      py: 1.15,
                      textDecoration: 'none',
                    }}
                  >
                    {item.label}
                  </Box>
                );
              })}
              <Button
                variant="outlined"
                onClick={onSignIn}
                startIcon={<LoginRoundedIcon />}
                sx={{ mt: 0.4 }}
              >
                {content.nav.mobileSignIn}
              </Button>
            </Box>
          ) : null}
        </Box>
      </Container>
    </Box>
  );
}
