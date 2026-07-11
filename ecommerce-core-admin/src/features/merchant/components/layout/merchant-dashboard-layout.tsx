import { Alert, Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { EcommerceCorePatternLayer } from '../../../../components/ecommerce_core-pattern-layer';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

const TOP_BAR_HEIGHT = {
  xs: 62,
  md: 68,
};

interface MerchantDashboardLayoutProps {
  bannerMessage: string;
  sidebar: ReactNode;
  topBar: ReactNode;
  mobileNavigation: ReactNode;
  children: ReactNode;
}

export function MerchantDashboardLayout({
  bannerMessage,
  sidebar,
  topBar,
  mobileNavigation,
  children,
}: MerchantDashboardLayoutProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        position: 'relative',
        overflowX: 'clip',
        overflowY: 'visible',
        // `row` already follows the page direction, so RTL keeps the sidebar on the right.
        flexDirection: 'row',
        minHeight: '100vh',
        bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#D6D5DA',
        backgroundImage:
          theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.026)} 0%, transparent 390px), linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.045)} 0%, transparent 38%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.18)} 0%, transparent 36%), linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.42)} 0%, transparent 380px)`,
      }}
    >
      <EcommerceCorePatternLayer
        variant="dashboard"
        anchor="end"
        opacity={theme.palette.mode === 'dark' ? 0.2 : 0.26}
        sx={{
          position: 'fixed',
          insetInlineStart: { xs: '-18%', lg: '18%' },
          insetInlineEnd: { xs: '-28%', lg: '-10%' },
          maskImage: 'linear-gradient(180deg, black 0%, black 54%, transparent 100%)',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, display: 'contents' }}>{sidebar}</Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            position: 'fixed',
            insetBlockStart: 0,
            insetInlineStart: { xs: 0, lg: `${ADMIN_TOKENS.layout.sidebarWidth}px` },
            insetInlineEnd: 0,
            zIndex: (currentTheme) => currentTheme.zIndex.drawer,
          }}
        >
          {topBar}
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            px: { xs: 1.25, md: 2.5, xl: 3.25 },
            pt: {
              xs: `${TOP_BAR_HEIGHT.xs + 10}px`,
              md: `${TOP_BAR_HEIGHT.md + 20}px`,
              xl: `${TOP_BAR_HEIGHT.md + 26}px`,
            },
            pb: { xs: 11, lg: 4, xl: 5 },
          }}
        >
          <Box
            sx={{
              maxWidth: ADMIN_TOKENS.layout.pageMaxWidth,
              mx: 'auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}
          >
            {bannerMessage ? (
              <Alert severity="success" sx={{ borderRadius: `${ADMIN_TOKENS.radius.md}px` }}>
                {bannerMessage}
              </Alert>
            ) : null}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</Box>
          </Box>
        </Box>
      </Box>

      {mobileNavigation}
    </Box>
  );
}
