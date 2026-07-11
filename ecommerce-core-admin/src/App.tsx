import {
  HomeRoundedIcon,
  LoginRoundedIcon,
  MenuRoundedIcon,
  PersonAddAlt1RoundedIcon,
  StorefrontRoundedIcon,
} from './components/icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { MerchantLoginPage } from './features/auth/merchant-login-page';
import { MerchantRegisterPage } from './features/auth/merchant-register-page';
import { MerchantAcceptInvitePage } from './features/auth/merchant-accept-invite-page';
import { MarketingHome } from './features/marketing/marketing-home';
import type { MarketingLocale } from './features/marketing/marketing-content';
import { MerchantDashboard } from './features/merchant/merchant-dashboard';
import { MerchantOnboarding } from './features/merchant/merchant-onboarding';
import { useMerchantSession } from './features/merchant/use-merchant-session';
import type { MerchantSession, StoreSettings } from './features/merchant/types';

const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';
const THEME_RIPPLE_EXPAND_MS = 680;
const SKIP_LINK_SX = {
  position: 'fixed',
  top: 8,
  insetInlineStart: 8,
  zIndex: 2000,
  transform: 'translateY(-140%)',
  '&:focus': { transform: 'translateY(0)' },
  bgcolor: 'primary.main',
  color: 'primary.contrastText',
  px: 1.5,
  py: 1,
  borderRadius: 1,
  fontWeight: 800,
  textDecoration: 'none',
};

type AppRoute = 'marketing' | 'register' | 'login' | 'merchant' | 'acceptInvite';
type ThemeMode = 'light' | 'dark';
type ThemeRippleOrigin = { x: number; y: number };
type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};
type ViewTransitionAnimationOptions = KeyframeAnimationOptions & {
  pseudoElement: string;
};

interface AppProps {
  marketingLocale: MarketingLocale;
  themeMode: ThemeMode;
  onMarketingLocaleChange: (locale: MarketingLocale) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
}

function resolveRoute(pathname: string): AppRoute {
  if (pathname === '/accept-invite') {
    return 'acceptInvite';
  }

  if (pathname === '/merchant') {
    return 'merchant';
  }

  if (pathname === '/register') {
    return 'register';
  }

  if (pathname === '/login') {
    return 'login';
  }

  return 'marketing';
}

function resolvePath(route: AppRoute): string {
  switch (route) {
    case 'register':
      return '/register';
    case 'login':
      return '/login';
    case 'merchant':
      return '/merchant';
    case 'acceptInvite':
      return '/accept-invite';
    case 'marketing':
    default:
      return '/';
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function calculateRippleRadius(origin: ThemeRippleOrigin): number {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const farthestX = Math.max(origin.x, width - origin.x);
  const farthestY = Math.max(origin.y, height - origin.y);

  return Math.ceil(Math.hypot(farthestX, farthestY)) + 48;
}

function animateThemeViewTransition(
  origin: ThemeRippleOrigin,
  applyTheme: () => void,
): Promise<void> | null {
  const root = document.documentElement;
  const startViewTransition = (document as ViewTransitionDocument).startViewTransition?.bind(
    document,
  );

  if (!startViewTransition) {
    return null;
  }

  root.setAttribute('data-theme-ripple', 'true');
  let transition: ViewTransition;

  try {
    transition = startViewTransition(applyTheme);
  } catch {
    root.removeAttribute('data-theme-ripple');
    return null;
  }
  const originPoint = `${origin.x}px ${origin.y}px`;
  const radius = calculateRippleRadius(origin);

  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [`circle(0px at ${originPoint})`, `circle(${radius}px at ${originPoint})`],
        },
        {
          duration: THEME_RIPPLE_EXPAND_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        } as ViewTransitionAnimationOptions,
      );
    })
    .catch(() => undefined);

  return transition.finished
    .finally(() => {
      root.removeAttribute('data-theme-ripple');
    })
    .catch(() => undefined);
}

export function App({
  marketingLocale,
  themeMode,
  onMarketingLocaleChange,
  onThemeModeChange,
}: AppProps) {
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [session, setSession] = useMerchantSession();
  const [route, setRoute] = useState<AppRoute>(() => resolveRoute(window.location.pathname));
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isThemeRippleRunningRef = useRef(false);

  const toggleThemeMode = useCallback(
    (origin?: ThemeRippleOrigin): void => {
      const nextMode = themeMode === 'dark' ? 'light' : 'dark';

      if (!origin || prefersReducedMotion()) {
        onThemeModeChange(nextMode);
        return;
      }

      if (isThemeRippleRunningRef.current) {
        return;
      }

      isThemeRippleRunningRef.current = true;
      const transition = animateThemeViewTransition(origin, () => {
        onThemeModeChange(nextMode);
      });

      if (!transition) {
        onThemeModeChange(nextMode);
        isThemeRippleRunningRef.current = false;
        return;
      }

      transition.finally(() => {
        isThemeRippleRunningRef.current = false;
      });
    },
    [onThemeModeChange, themeMode],
  );

  const toggleMarketingLocale = useCallback((): void => {
    onMarketingLocaleChange(marketingLocale === 'ar' ? 'en' : 'ar');
  }, [marketingLocale, onMarketingLocaleChange]);

  useEffect(() => {
    let cancelled = false;

    async function resolveOnboardingState(currentSession: MerchantSession): Promise<void> {
      if (currentSession.user.onboardingCompleted) {
        setShowOnboarding(false);
        return;
      }

      try {
        const response = await fetch(`${currentSession.apiBaseUrl}/store/settings`, {
          headers: {
            authorization: `Bearer ${currentSession.accessToken}`,
            'x-store-id': currentSession.user.storeId,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Unable to load store settings');
        }

        const settings = (await response.json()) as StoreSettings;
        if (cancelled) {
          return;
        }

        if (settings.onboardingCompleted) {
          setSession({
            ...currentSession,
            user: {
              ...currentSession.user,
              onboardingCompleted: true,
            },
          });
          setShowOnboarding(false);
          return;
        }
      } catch {
        if (cancelled) {
          return;
        }
      }

      setShowOnboarding(true);
    }

    if (!session) {
      setShowOnboarding(false);
      return () => {
        cancelled = true;
      };
    }

    resolveOnboardingState(session).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [session, setSession]);

  useEffect(() => {
    const nextRoute = resolveRoute(window.location.pathname);
    const expectedPath = resolvePath(nextRoute);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath);
    }

    setRoute(nextRoute);

    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, replace = false): void => {
    const nextPath = resolvePath(nextRoute);
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    }
    setRoute(nextRoute);
    setMobileDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (route === 'merchant' && !session) {
      navigate('login', true);
      return;
    }

    if ((route === 'login' || route === 'register' || route === 'acceptInvite') && session) {
      navigate('merchant', true);
    }
  }, [navigate, route, session]);

  const navigationItems = useMemo<Array<{ route: AppRoute; label: string; icon: ReactElement }>>(
    () => [
      { route: 'marketing', label: 'الرئيسية', icon: <HomeRoundedIcon fontSize="small" /> },
      {
        route: 'register',
        label: 'إنشاء حساب',
        icon: <PersonAddAlt1RoundedIcon fontSize="small" />,
      },
      { route: 'login', label: 'دخول التاجر', icon: <LoginRoundedIcon fontSize="small" /> },
      { route: 'merchant', label: 'لوحة التاجر', icon: <StorefrontRoundedIcon fontSize="small" /> },
    ],
    [],
  );

  const shellItems = useMemo(
    () =>
      route === 'merchant'
        ? navigationItems.filter((item) => item.route === 'merchant')
        : navigationItems,
    [navigationItems, route],
  );

  function renderRouteContent(currentRoute: AppRoute, currentSession: MerchantSession | null) {
    if (currentRoute === 'marketing') {
      return (
        <MarketingHome
          locale={marketingLocale}
          themeMode={themeMode}
          onCreateAccount={() => navigate('register')}
          onSignIn={() => navigate('login')}
          onToggleLocale={toggleMarketingLocale}
          onToggleThemeMode={toggleThemeMode}
        />
      );
    }

    if (currentRoute === 'register') {
      return (
        <MerchantRegisterPage
          onBackHome={() => navigate('marketing')}
          onSignIn={() => navigate('login')}
          onRegistered={(nextSession) => {
            setSession(nextSession);
            navigate('merchant', true);
          }}
        />
      );
    }

    if (currentRoute === 'login') {
      return (
        <MerchantLoginPage
          onLoggedIn={(nextSession) => {
            setSession(nextSession);
            navigate('merchant', true);
          }}
          onBackHome={() => navigate('marketing')}
          onCreateAccount={() => navigate('register')}
        />
      );
    }

    if (currentRoute === 'acceptInvite') {
      return (
        <MerchantAcceptInvitePage
          onAccepted={(nextSession) => {
            setSession(nextSession);
            navigate('merchant', true);
          }}
          onBackHome={() => navigate('marketing')}
          onSignIn={() => navigate('login')}
        />
      );
    }

    if (currentRoute === 'merchant' && currentSession) {
      if (showOnboarding) {
        return (
          <MerchantOnboarding
            session={currentSession}
            onCompleted={(nextSession) => {
              setSession(nextSession);
              setShowOnboarding(false);
            }}
            onSignedOut={() => {
              setSession(null);
              navigate('login', true);
            }}
          />
        );
      }

      return (
        <MerchantDashboard
          session={currentSession}
          onSessionUpdate={setSession}
          themeMode={themeMode}
          onToggleThemeMode={toggleThemeMode}
          onSignedOut={() => {
            setSession(null);
            navigate('login', true);
          }}
        />
      );
    }

    return null;
  }

  const activeShellIndex = shellItems.findIndex((item) => item.route === route);
  const isStandalonePage =
    route === 'marketing' || route === 'register' || route === 'login' || route === 'acceptInvite';

  if (route === 'merchant') {
    if (showOnboarding) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            backgroundColor: 'background.default',
            py: { xs: 2, md: 4 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Container maxWidth="lg">{renderRouteContent(route, session)}</Container>
        </Box>
      );
    }
    return (
      <>
        <Box component="a" href="#merchant-main-content" sx={SKIP_LINK_SX}>
          تجاوز إلى المحتوى الرئيسي
        </Box>
        <Box id="merchant-main-content">{renderRouteContent(route, session)}</Box>
      </>
    );
  }

  if (isStandalonePage) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', py: { xs: 1, md: 2 } }}>
        <Box component="a" href="#merchant-main-content" sx={SKIP_LINK_SX}>
          تجاوز إلى المحتوى الرئيسي
        </Box>
        <Container maxWidth="xl" id="merchant-main-content">{renderRouteContent(route, session)}</Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" elevation={0}>
        <Toolbar sx={{ gap: 1.5, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {isMobile ? (
              <IconButton onClick={() => setMobileDrawerOpen(true)} aria-label="فتح القائمة">
                <MenuRoundedIcon />
              </IconButton>
            ) : null}
            <Stack spacing={0}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                بوابة إدارة النظام
              </Typography>
              <Typography variant="caption" color="text.secondary">
                المسار الحالي: {resolvePath(route)}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {session ? (
              <Chip
                variant="outlined"
                label={`مرحباً ${session.user.fullName}`}
                icon={<StorefrontRoundedIcon fontSize="small" />}
              />
            ) : (
              <Button size="small" onClick={() => navigate('login')}>
                تسجيل الدخول
              </Button>
            )}
            <Box
              component="img"
              src={ecommerce_core_ICON_SRC}
              alt="Ecommerce Core"
              sx={{
                width: 36,
                height: 36,
                objectFit: 'contain',
                filter:
                  theme.palette.mode === 'dark'
                    ? 'drop-shadow(0 6px 10px rgba(0,0,0,0.28))'
                    : 'none',
              }}
            />
          </Stack>
        </Toolbar>
      </AppBar>

      <Toolbar />

      <Drawer
        anchor={isRtl ? 'right' : 'left'}
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileDrawerOpen : true}
        onClose={() => setMobileDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            borderInlineEnd: '1px solid',
            borderColor: 'divider',
            pt: 1,
          },
        }}
      >
        <Typography variant="subtitle1" sx={{ px: 2, py: 1, fontWeight: 800 }}>
          التنقل
        </Typography>
        <Divider />
        <List
          sx={{
            py: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          {navigationItems.map((item) => (
            <ListItemButton
              key={item.route}
              selected={route === item.route}
              onClick={() => navigate(item.route)}
              sx={{ mx: 1, borderRadius: 2, direction: 'rtl' }}
            >
              {item.icon}
              <ListItemText
                sx={{ marginInlineStart: 1, textAlign: 'start' }}
                primary={item.label}
              />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="a" href="#merchant-main-content" sx={SKIP_LINK_SX}>
        تجاوز إلى المحتوى الرئيسي
      </Box>

      <Box
        component="main"
        id="merchant-main-content"
        sx={{
          marginInlineStart: { xs: 0, md: '280px' },
          pb: isMobile ? 10 : 3,
        }}
      >
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, borderRadius: 3 }}>
            {renderRouteContent(route, session)}
          </Paper>
        </Container>
      </Box>

      {isMobile ? (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <BottomNavigation
            value={activeShellIndex >= 0 ? activeShellIndex : 0}
            onChange={(_, nextIndex) => {
              const nextItem = shellItems[nextIndex];
              if (nextItem) {
                navigate(nextItem.route);
              }
            }}
            showLabels
          >
            {shellItems.map((item) => (
              <BottomNavigationAction key={item.route} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}
    </Box>
  );
}
