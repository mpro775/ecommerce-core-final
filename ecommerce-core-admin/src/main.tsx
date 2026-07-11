import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { StrictMode, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import { App } from './App';
import { enforceLatinDigitsInLocaleFormatting } from './lib/force-latin-digits';
import { useLocalStorageState } from './lib/use-local-storage-state';
import { DEFAULT_MARKETING_LOCALE, resolveMarketingLocale } from './features/marketing/marketing-content';
import { MerchantAccessibilitySettings } from './features/accessibility/merchant-accessibility-settings';
import { createAdminTheme } from './theme/theme';

const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

enforceLatinDigitsInLocaleFormatting();

document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'ar');
document.body.setAttribute('dir', 'rtl');

function Root() {
  const [themeMode, setThemeMode] = useLocalStorageState('admin.theme.mode.v1', 'light');
  const [marketingLocaleValue, setMarketingLocale] = useLocalStorageState(
    'admin.marketing.language.v1',
    DEFAULT_MARKETING_LOCALE,
  );

  const mode = themeMode === 'dark' ? 'dark' : 'light';
  const marketingLocale = resolveMarketingLocale(marketingLocaleValue);
  const theme = useMemo(() => createAdminTheme(mode), [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '*:focus-visible': {
            outline: '3px solid #ffbf47',
            outlineOffset: 2,
          },
          'html.a11y-strong-focus *:focus-visible': {
            outline: '4px solid #ffbf47',
            outlineOffset: 3,
          },
          'html.a11y-font-115': { fontSize: '115%' },
          'html.a11y-font-130': { fontSize: '130%' },
          'html.a11y-font-150': { fontSize: '150%' },
          'html.a11y-underline-links a': {
            textDecoration: 'underline',
            textUnderlineOffset: '0.18em',
          },
          'html.a11y-high-contrast body': {
            backgroundColor: '#fff',
            color: '#111',
          },
          'html.a11y-reduced-motion *, html.a11y-reduced-motion *::before, html.a11y-reduced-motion *::after':
            {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              scrollBehavior: 'auto !important',
              transitionDuration: '0.01ms !important',
            },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              scrollBehavior: 'auto !important',
              transitionDuration: '0.01ms !important',
            },
          },
        }}
      />
      <App
        marketingLocale={marketingLocale}
        themeMode={mode}
        onMarketingLocaleChange={setMarketingLocale}
        onThemeModeChange={setThemeMode}
      />
      <MerchantAccessibilitySettings />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <CacheProvider value={cacheRtl}>
      <Root />
    </CacheProvider>
  </StrictMode>,
);
