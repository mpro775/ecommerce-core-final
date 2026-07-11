import { arSD } from '@mui/material/locale';
import { alpha, createTheme, type PaletteMode } from '@mui/material/styles';
import '@fontsource/cairo';
import '@fontsource/tajawal';
import { ADMIN_TOKENS } from './tokens';

const lightPalette = {
  primaryMain: ADMIN_TOKENS.brand.primary,
  primaryDark: ADMIN_TOKENS.brand.primaryDark,
  primaryLight: ADMIN_TOKENS.brand.primaryLight,
  secondaryMain: ADMIN_TOKENS.brand.secondary,
  secondaryDark: ADMIN_TOKENS.brand.secondaryDark,
  secondaryLight: ADMIN_TOKENS.brand.secondaryLight,
  accentMain: ADMIN_TOKENS.brand.accent,
  page: '#D6D5DA',
  paper: '#FFFFFF',
  panel: '#F3F0FA',
  field: '#F7F4FD',
  textPrimary: '#211A32',
  textSecondary: '#6F6680',
  divider: '#E3DDEE',
  dividerStrong: '#CBC2DE',
  tableHead: '#F0ECF8',
};

const darkPalette = {
  primaryMain: '#9B7AE6',
  primaryDark: '#6F55B8',
  primaryLight: '#2B2538',
  secondaryMain: '#6EC5D6',
  secondaryDark: '#3A9CAE',
  secondaryLight: '#183239',
  accentMain: '#E064D8',
  page: '#0F1012',
  paper: '#17181B',
  panel: '#1F2024',
  field: '#24262B',
  textPrimary: '#F4F5F6',
  textSecondary: '#B7BAC0',
  divider: '#34363A',
  dividerStrong: '#45474D',
  tableHead: '#202226',
};

export function createAdminTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';
  const paletteTokens = isDark ? darkPalette : lightPalette;
  const primaryMain = paletteTokens.primaryMain;
  const primaryDark = paletteTokens.primaryDark;
  const surfaceTint = paletteTokens.field;
  const radius = ADMIN_TOKENS.radius;
  const heights = ADMIN_TOKENS.heights;
  const elevation = ADMIN_TOKENS.elevation;
  const stateOpacity = ADMIN_TOKENS.stateOpacity;

  return createTheme(
    {
      direction: 'rtl',
      palette: {
        mode,
        primary: {
          main: primaryMain,
          dark: primaryDark,
          light: paletteTokens.primaryLight,
          contrastText: '#ffffff',
        },
        secondary: {
          main: paletteTokens.secondaryMain,
          dark: paletteTokens.secondaryDark,
          light: paletteTokens.secondaryLight,
        },
        success: {
          main: isDark ? '#4BD08C' : ADMIN_TOKENS.status.success,
          light: isDark ? '#123A2A' : ADMIN_TOKENS.status.successSoft,
          dark: isDark ? '#2BA66B' : '#0F7049',
        },
        warning: {
          main: isDark ? '#F2B84B' : ADMIN_TOKENS.status.warning,
          light: isDark ? '#493713' : ADMIN_TOKENS.status.warningSoft,
          dark: isDark ? '#C98C1B' : '#8A5200',
        },
        error: {
          main: isDark ? '#FF7A7A' : ADMIN_TOKENS.status.error,
          light: isDark ? '#4A1D1D' : ADMIN_TOKENS.status.errorSoft,
          dark: isDark ? '#D94F4F' : '#9C2525',
        },
        info: {
          main: paletteTokens.accentMain,
          light: isDark ? '#123B45' : ADMIN_TOKENS.brand.accentLight,
          dark: isDark ? '#45BFD4' : ADMIN_TOKENS.brand.accentDark,
        },
        background: {
          default: paletteTokens.page,
          paper: paletteTokens.paper,
        },
        text: {
          primary: paletteTokens.textPrimary,
          secondary: paletteTokens.textSecondary,
        },
        divider: paletteTokens.divider,
      },
      typography: {
        fontFamily: 'Tajawal, Cairo, sans-serif',
        fontSize: 13.5,
        h1: {
          fontWeight: 800,
          fontFamily: 'Cairo, Tajawal, sans-serif',
          letterSpacing: 0,
        },
        h2: {
          fontWeight: 800,
          fontFamily: 'Cairo, Tajawal, sans-serif',
          letterSpacing: 0,
        },
        h3: {
          fontWeight: 800,
          fontFamily: 'Cairo, Tajawal, sans-serif',
          letterSpacing: 0,
        },
        h4: {
          fontWeight: 800,
          fontFamily: 'Cairo, Tajawal, sans-serif',
          fontSize: '1.46rem',
          lineHeight: 1.35,
          letterSpacing: 0,
        },
        h5: {
          fontWeight: 700,
          fontSize: '1.16rem',
          lineHeight: 1.35,
          color: isDark ? paletteTokens.textPrimary : primaryDark,
          letterSpacing: 0,
        },
        h6: {
          fontWeight: 700,
          fontSize: '1.02rem',
          lineHeight: 1.4,
          letterSpacing: 0,
        },
        button: {
          fontWeight: 700,
          fontSize: '0.86rem',
          lineHeight: 1.2,
          fontFamily: 'Tajawal, Cairo, sans-serif',
        },
        subtitle1: {
          fontWeight: 700,
          fontSize: '0.94rem',
          lineHeight: 1.45,
          fontFamily: 'Tajawal, Cairo, sans-serif',
        },
        body1: {
          fontSize: '0.92rem',
          lineHeight: 1.6,
        },
        body2: {
          fontSize: '0.84rem',
          color: paletteTokens.textSecondary,
          lineHeight: 1.6,
        },
        subtitle2: {
          fontWeight: 700,
          fontSize: '0.82rem',
          lineHeight: 1.45,
          fontFamily: 'Tajawal, Cairo, sans-serif',
        },
        caption: {
          fontSize: '0.74rem',
          lineHeight: 1.45,
          fontFamily: 'Tajawal, Cairo, sans-serif',
        },
      },
      shape: {
        borderRadius: radius.md,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            html: {
              direction: 'rtl',
            },
            body: {
              margin: 0,
              backgroundColor: paletteTokens.page,
              backgroundImage: isDark
                ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0%, rgba(15, 16, 18, 0) 380px), linear-gradient(135deg, rgba(155, 122, 230, 0.045) 0%, rgba(15, 16, 18, 0) 42%)'
                : 'linear-gradient(180deg, rgba(212, 209, 231, 0.62) 0%, rgba(249, 247, 254, 0) 360px)',
              color: paletteTokens.textPrimary,
              transition: 'background-color 180ms ease, color 180ms ease',
            },
            'html[data-theme-ripple="true"]::view-transition-old(root), html[data-theme-ripple="true"]::view-transition-new(root)':
              {
                animation: 'none',
                mixBlendMode: 'normal',
              },
            'html[data-theme-ripple="true"]::view-transition-old(root)': {
              zIndex: 0,
            },
            'html[data-theme-ripple="true"]::view-transition-new(root)': {
              zIndex: 1,
            },
            '#root': {
              minHeight: '100vh',
            },
            '*': {
              boxSizing: 'border-box',
            },
          },
        },
        MuiButton: {
          defaultProps: {
            disableElevation: true,
            size: 'medium',
          },
          styleOverrides: {
            root: {
              minHeight: heights.buttonMd,
              borderRadius: radius.pill,
              textTransform: 'none',
              fontWeight: 700,
              paddingInline: 16,
              whiteSpace: 'nowrap',
            },
            containedPrimary: {
              background: isDark
                ? 'linear-gradient(90deg, #7657C8 0%, #9B7AE6 100%)'
                : 'linear-gradient(90deg, #502E91 0%, #6757A9 100%)',
              color: '#ffffff',
              boxShadow: isDark
                ? '0 12px 26px rgba(155, 122, 230, 0.16)'
                : '0 10px 22px rgba(80, 46, 145, 0.2)',
              '&:hover': {
                background: isDark
                  ? 'linear-gradient(90deg, #6F55B8 0%, #8D6FE0 100%)'
                  : 'linear-gradient(90deg, #43277C 0%, #59489A 100%)',
              },
              '&&.Mui-disabled': {
                background: isDark
                  ? `linear-gradient(90deg, ${alpha('#7657C8', 0.42)} 0%, ${alpha('#9B7AE6', 0.5)} 100%)`
                  : `linear-gradient(90deg, ${alpha('#502E91', 0.54)} 0%, ${alpha('#6757A9', 0.58)} 100%)`,
                color: alpha('#FFFFFF', isDark ? 0.72 : 0.68),
                boxShadow: 'none',
                '& .MuiButton-startIcon, & .MuiButton-endIcon': {
                  color: alpha('#FFFFFF', isDark ? 0.72 : 0.68),
                },
              },
            },
            outlined: {
              borderColor: alpha(primaryMain, isDark ? 0.34 : 0.28),
              '&:hover': {
                borderColor: primaryMain,
                backgroundColor: alpha(primaryMain, stateOpacity.hover),
              },
            },
            sizeSmall: {
              minHeight: heights.buttonSm,
              borderRadius: radius.pill,
              paddingInline: 12,
            },
            sizeLarge: {
              minHeight: heights.buttonLg,
              borderRadius: radius.pill,
              paddingInline: 20,
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: radius.xl,
              border: `1px solid ${alpha(
                isDark ? '#FFFFFF' : paletteTokens.dividerStrong,
                isDark ? 0.1 : 0.62,
              )}`,
              boxShadow: isDark
                ? '0 18px 40px rgba(9, 7, 16, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
                : elevation.glass,
              backgroundImage: 'none',
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: radius.md,
              border: `1px solid ${paletteTokens.divider}`,
              boxShadow: isDark ? '0 14px 30px rgba(9, 7, 16, 0.22)' : elevation.xs,
            },
          },
        },
        MuiOutlinedInput: {
          defaultProps: {
            size: 'small',
          },
          styleOverrides: {
            root: {
              minHeight: heights.input,
              borderRadius: radius.lg,
              backgroundColor: alpha(surfaceTint, isDark ? 0.78 : 0.82),
              '& fieldset': {
                borderColor: paletteTokens.divider,
              },
              '&:hover fieldset': {
                borderColor: primaryMain,
              },
              '&.Mui-focused fieldset': {
                borderColor: primaryMain,
                boxShadow: `0 0 0 2px ${alpha(primaryMain, isDark ? 0.28 : 0.2)}`,
              },
            },
            input: {
              paddingTop: 10,
              paddingBottom: 10,
            },
          },
        },
        MuiTextField: {
          defaultProps: {
            variant: 'outlined',
            fullWidth: true,
            size: 'small',
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: alpha(paletteTokens.paper, isDark ? 0.76 : 0.7),
              color: paletteTokens.textPrimary,
              backdropFilter: 'blur(24px)',
              boxShadow: isDark ? '0 18px 42px rgba(9, 7, 16, 0.24)' : elevation.glass,
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              border: 0,
              borderInlineEnd: `1px solid ${paletteTokens.divider}`,
              backgroundColor: paletteTokens.paper,
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              minHeight: heights.buttonLg,
            },
            indicator: {
              height: 3,
              borderRadius: 999,
              backgroundColor: paletteTokens.accentMain,
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minHeight: heights.buttonLg,
              paddingInline: 16,
              borderRadius: radius.md,
              textTransform: 'none',
              fontWeight: 600,
              '&.Mui-selected': {
                color: isDark ? paletteTokens.textPrimary : primaryDark,
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              height: 28,
              fontWeight: 700,
              borderRadius: 999,
            },
          },
        },
        MuiTableContainer: {
          styleOverrides: {
            root: {
              borderRadius: radius.md,
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              '& .MuiTableRow-root': {
                backgroundColor: isDark ? alpha('#FFFFFF', 0.045) : alpha(primaryMain, 0.07),
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              padding: '12px 16px',
              verticalAlign: 'middle',
              borderBottomColor: paletteTokens.divider,
            },
            head: {
              height: heights.tableHeadRow,
              fontWeight: 700,
              color: paletteTokens.textSecondary,
              fontSize: '0.79rem',
            },
            body: {
              minHeight: heights.tableRow,
            },
          },
        },
        MuiToolbar: {
          styleOverrides: {
            root: {
              minHeight: heights.toolbar,
              paddingInline: 24,
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              minHeight: 40,
              borderRadius: radius.sm,
              margin: 4,
            },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: {
              borderRadius: radius.md,
            },
          },
        },
      },
    },
    arSD,
  );
}

const theme = createAdminTheme('light');

export default theme;
