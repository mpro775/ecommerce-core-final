import { Box, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  toneColor?: string;
  toneBackground?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  toneColor = 'primary.main',
  toneBackground = 'action.hover',
}: StatCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolvedTone = toneColor === 'primary.main' ? theme.palette.primary.main : toneColor;
  const resolvedToneBackground =
    toneBackground === 'action.hover'
      ? isDark
        ? alpha(theme.palette.common.white, 0.07)
        : alpha(theme.palette.primary.main, 0.08)
      : toneBackground;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, md: 2.5 },
        borderRadius: `${ADMIN_TOKENS.radius.xxl}px`,
        border: '1px solid',
        borderColor: (currentTheme) =>
          alpha(
            currentTheme.palette.common.white,
            currentTheme.palette.mode === 'dark' ? 0.12 : 0.66,
          ),
        height: '100%',
        bgcolor: (currentTheme) =>
          currentTheme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.glassDark
            : ADMIN_TOKENS.surfaces.glassLight,
        backdropFilter: 'blur(20px)',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: alpha(resolvedTone, 0.32),
          boxShadow: (currentTheme) =>
            currentTheme.palette.mode === 'dark'
              ? '0 18px 34px rgba(0, 0, 0, 0.24)'
              : `0 18px 34px ${alpha(resolvedTone, 0.12)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {icon ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: `${ADMIN_TOKENS.radius.pill}px`,
              bgcolor: resolvedToneBackground,
              color: resolvedTone,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}
