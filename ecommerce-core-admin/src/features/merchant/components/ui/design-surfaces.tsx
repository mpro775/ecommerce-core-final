import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { EcommerceCorePatternLayer } from '../../../../components/ecommerce_core-pattern-layer';
import { ADMIN_TOKENS } from '../../../../theme/tokens';
import { EcommerceCoreLoader } from './ecommerce_core-loader';

interface GlassHeroProps {
  children: ReactNode;
  aside?: ReactNode;
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: string;
}

interface GlassSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

interface GlassSectionCardProps {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function GlassHero({ children, aside }: GlassHeroProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: { xs: 3.5, md: `${ADMIN_TOKENS.radius.hero}px` },
        p: { xs: 2.25, md: 3.5 },
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.72),
        bgcolor: isDark ? ADMIN_TOKENS.surfaces.glassDark : ADMIN_TOKENS.surfaces.glassLight,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark
          ? '0 24px 52px rgba(9, 7, 16, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
          : ADMIN_TOKENS.elevation.floating,
      }}
    >
      <EcommerceCorePatternLayer
        variant="section"
        anchor="end"
        opacity={isDark ? 0.2 : 0.28}
        sx={{ insetInlineStart: '28%', maskImage: 'linear-gradient(90deg, transparent 0%, black 32%, black 100%)' }}
      />
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          gap: { xs: 2.5, lg: 3.5 },
          gridTemplateColumns: aside
            ? { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)' }
            : '1fr',
          alignItems: 'stretch',
        }}
      >
        {children}
        {aside}
      </Box>
    </Paper>
  );
}

export function GlassSectionBand({ title, icon, children }: GlassSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        p: { xs: 1.25, md: 1.75 },
        borderRadius: { xs: 3, md: 4 },
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, isDark ? 0.1 : 0.52),
        bgcolor: isDark ? ADMIN_TOKENS.surfaces.softDark : ADMIN_TOKENS.surfaces.softLight,
      }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          {icon ? (
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: theme.palette.primary.main,
                bgcolor: isDark
                  ? alpha(theme.palette.common.white, 0.07)
                  : alpha(theme.palette.primary.main, 0.1),
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary' }}>
            {title}
          </Typography>
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

export function GlassSectionCard({ title, eyebrow, icon, children }: GlassSectionCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        minWidth: 0,
        p: { xs: 2, md: 2.35 },
        borderRadius: { xs: 2.75, md: 3.5 },
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.68),
        bgcolor: isDark ? ADMIN_TOKENS.surfaces.tableDark : ADMIN_TOKENS.surfaces.tableLight,
        backdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 18px 38px rgba(9, 7, 16, 0.22), inset 0 1px 0 rgba(255,255,255,0.035)'
          : '0 18px 38px rgba(80,46,145,0.08)',
        '& .MuiTableCell-head': {
          color: 'text.secondary',
          fontWeight: 900,
          bgcolor: isDark
            ? alpha(theme.palette.common.white, 0.045)
            : alpha(theme.palette.primary.main, 0.07),
        },
        '& .MuiTableRow-root:hover': {
          bgcolor: isDark
            ? alpha(theme.palette.common.white, 0.04)
            : alpha(theme.palette.primary.main, 0.045),
        },
      }}
    >
      <EcommerceCorePatternLayer
        variant="card"
        anchor="end"
        opacity={isDark ? 0.16 : 0.2}
        sx={{ insetInlineStart: '36%', maskImage: 'linear-gradient(90deg, transparent 0%, black 42%, black 100%)' }}
      />
      <Stack spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
            {icon ? (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  color: theme.palette.primary.main,
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.07)
                    : alpha(theme.palette.primary.main, 0.1),
                }}
              >
                {icon}
              </Box>
            ) : null}
            <Typography variant="h6" sx={{ fontWeight: 900, color: 'text.primary' }}>
              {title}
            </Typography>
          </Stack>
          {eyebrow ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 850, whiteSpace: 'nowrap' }}
            >
              {eyebrow}
            </Typography>
          ) : null}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'primary.main',
}: MetricCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolvedTone = tone === 'primary.main' ? theme.palette.primary.main : tone;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        p: { xs: 2, md: 2.25 },
        borderRadius: { xs: 3, md: 4 },
        border: '1px solid',
        borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.66),
        bgcolor: isDark ? ADMIN_TOKENS.surfaces.glassDark : ADMIN_TOKENS.surfaces.glassLight,
        backdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 18px 38px rgba(9, 7, 16, 0.2), inset 0 1px 0 rgba(255,255,255,0.035)'
          : '0 18px 38px rgba(80,46,145,0.08)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(resolvedTone, 0.34),
          boxShadow: isDark
            ? '0 22px 42px rgba(0, 0, 0, 0.24)'
            : `0 22px 42px ${alpha(resolvedTone, 0.13)}`,
        },
      }}
    >
      <EcommerceCorePatternLayer
        variant="card"
        anchor="end"
        opacity={isDark ? 0.16 : 0.22}
        sx={{ insetInlineStart: '34%', maskImage: 'linear-gradient(90deg, transparent 0%, black 44%, black 100%)' }}
      />
      <Stack spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>
          {icon ? (
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: resolvedTone,
                bgcolor: isDark
                  ? alpha(theme.palette.common.white, 0.07)
                  : alpha(resolvedTone, 0.1),
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          ) : null}
        </Stack>
        <Box>
          <Typography
            variant="h5"
            sx={{ color: 'text.primary', fontWeight: 950, overflowWrap: 'anywhere' }}
          >
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}

export function SoftRow({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  compact?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={1.5}
      sx={{
        minHeight: compact ? 28 : 38,
        px: compact ? 0 : 1.25,
        py: compact ? 0.25 : 0.8,
        borderRadius: compact ? 0 : 999,
        bgcolor: compact
          ? 'transparent'
          : isDark
            ? alpha(theme.palette.common.white, 0.045)
            : alpha(theme.palette.primary.main, 0.045),
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: compact ? 700 : 800 }}>
        {label}
      </Typography>
      <Box
        sx={{ color: 'text.primary', fontWeight: 900, textAlign: 'end', overflowWrap: 'anywhere' }}
      >
        {value}
      </Box>
    </Stack>
  );
}

export function SoftPanel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        p: 1.35,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, isDark ? 0.82 : 0.78),
        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.54 : 0.52),
        ...sx,
      }}
    >
      <Stack spacing={0.65}>{children}</Stack>
    </Box>
  );
}

export function LoadingBlock() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
      <EcommerceCoreLoader size="md" compact />
    </Box>
  );
}

export function EmptyState({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: 92,
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 2.5,
        borderRadius: 3,
        border: '1px dashed',
        borderColor: alpha(
          theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.16 : 0.24,
        ),
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.035)
            : alpha(theme.palette.primary.main, 0.045),
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
        {text}
      </Typography>
    </Box>
  );
}
