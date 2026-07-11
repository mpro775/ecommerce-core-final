export const ADMIN_SPACING_SCALE = Object.freeze({
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
});

export const ADMIN_RADIUS = Object.freeze({
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  hero: 34,
  pill: 999,
});

export const ADMIN_HEIGHTS = Object.freeze({
  input: 44,
  buttonSm: 36,
  buttonMd: 40,
  buttonLg: 44,
  toolbar: 72,
  pageHeader: 92,
  filterBar: 64,
  tableHeadRow: 48,
  tableRow: 56,
});

export const ADMIN_LAYOUT = Object.freeze({
  sidebarWidth: 296,
  pageMaxWidth: 1360,
  contentMaxWidth: 1240,
  formMaxWidth: 960,
  compactMaxWidth: 860,
});

export const ADMIN_CONTAINER_WIDTHS = Object.freeze({
  xl: 1360,
  lg: 1240,
  md: 960,
  sm: 860,
});

export interface BrandColorTokens {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  accent: string;
  accentDark: string;
  accentLight: string;
}

export interface SurfaceTokens {
  page: string;
  canvas: string;
  panel: string;
  elevated: string;
  muted: string;
  border: string;
  borderStrong: string;
}

export interface DataVizTokens {
  revenue: string;
  orders: string;
  average: string;
  risk: string;
  recovery: string;
  neutral: string;
}

export interface InteractionStateTokens {
  hover: number;
  selected: number;
  focus: number;
  disabled: number;
}

export interface PatternColorTokens {
  patternInk: string;
  patternNode: string;
  patternGlow: string;
  patternMuted: string;
}

export const ADMIN_BRAND_COLORS = Object.freeze<BrandColorTokens>({
  primary: '#502E91',
  primaryDark: '#35205F',
  primaryLight: '#D4D1E7',
  secondary: '#6EC5D6',
  secondaryDark: '#2F91A7',
  secondaryLight: '#E5F7FB',
  accent: '#8B7EC0',
  accentDark: '#6757A9',
  accentLight: '#F0EDF8',
});

export const ADMIN_STATUS_COLORS = Object.freeze({
  success: '#168A5B',
  successSoft: '#E4F6EE',
  warning: '#B86E00',
  warningSoft: '#FFF2D8',
  error: '#C93737',
  errorSoft: '#FCE7E7',
  info: ADMIN_BRAND_COLORS.primary,
  infoSoft: ADMIN_BRAND_COLORS.primaryLight,
});

export const ADMIN_DATA_COLORS = Object.freeze<DataVizTokens>({
  revenue: ADMIN_STATUS_COLORS.success,
  orders: ADMIN_BRAND_COLORS.primary,
  average: ADMIN_STATUS_COLORS.warning,
  risk: '#7A3F8F',
  recovery: ADMIN_BRAND_COLORS.accent,
  neutral: '#64748B',
});

export const ADMIN_ELEVATION = Object.freeze({
  none: 'none',
  xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
  sm: '0 8px 18px rgba(15, 23, 42, 0.08)',
  md: '0 14px 32px rgba(15, 23, 42, 0.10)',
  lg: '0 22px 48px rgba(15, 23, 42, 0.12)',
  glass: '0 24px 52px rgba(80, 46, 145, 0.10)',
  floating: '0 28px 60px rgba(80, 46, 145, 0.14)',
});

export const ADMIN_SURFACES = Object.freeze({
  glassLight: 'rgba(255, 255, 255, 0.66)',
  glassDark: 'rgba(23, 24, 27, 0.78)',
  softLight: 'rgba(255, 255, 255, 0.48)',
  softDark: 'rgba(31, 32, 36, 0.56)',
  heroLight:
    'linear-gradient(145deg, rgba(255,255,255,0.42) 0%, rgba(212,209,231,0.34) 54%, rgba(255,255,255,0.2) 100%)',
  heroDark:
    'linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(24,25,28,0.72) 54%, rgba(15,16,18,0.44) 100%)',
  tableLight: 'rgba(255, 255, 255, 0.72)',
  tableDark: 'rgba(24, 25, 28, 0.88)',
});

export const ADMIN_PATTERN_COLORS = Object.freeze<Record<'light' | 'dark', PatternColorTokens>>({
  light: {
    patternInk: 'rgba(80, 46, 145, 0.34)',
    patternNode: 'rgba(110, 197, 214, 0.46)',
    patternGlow: 'rgba(80, 46, 145, 0.12)',
    patternMuted: 'rgba(139, 126, 192, 0.18)',
  },
  dark: {
    patternInk: 'rgba(155, 122, 230, 0.38)',
    patternNode: 'rgba(110, 197, 214, 0.38)',
    patternGlow: 'rgba(155, 122, 230, 0.16)',
    patternMuted: 'rgba(255, 255, 255, 0.10)',
  },
});

export const ADMIN_STATE_OPACITY = Object.freeze<InteractionStateTokens>({
  hover: 0.08,
  selected: 0.12,
  focus: 0.22,
  disabled: 0.38,
});

export const ADMIN_TOKENS = Object.freeze({
  spacing: ADMIN_SPACING_SCALE,
  radius: ADMIN_RADIUS,
  heights: ADMIN_HEIGHTS,
  layout: ADMIN_LAYOUT,
  containerWidths: ADMIN_CONTAINER_WIDTHS,
  brand: ADMIN_BRAND_COLORS,
  status: ADMIN_STATUS_COLORS,
  dataViz: ADMIN_DATA_COLORS,
  elevation: ADMIN_ELEVATION,
  surfaces: ADMIN_SURFACES,
  pattern: ADMIN_PATTERN_COLORS,
  stateOpacity: ADMIN_STATE_OPACITY,
});
