import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

type EcommerceCoreLoaderSize = 'sm' | 'md' | 'lg';

interface EcommerceCoreLoaderProps {
  size?: EcommerceCoreLoaderSize;
  label?: string;
  tone?: 'primary' | 'secondary' | 'neutral';
  compact?: boolean;
  sx?: SxProps<Theme>;
}

const SIZE_MAP: Record<EcommerceCoreLoaderSize, { mark: number; dot: number; font: string }> = {
  sm: { mark: 34, dot: 5, font: '0.78rem' },
  md: { mark: 48, dot: 7, font: '0.86rem' },
  lg: { mark: 64, dot: 9, font: '0.94rem' },
};

export function EcommerceCoreLoader({
  size = 'md',
  label = 'جاري التحميل...',
  tone = 'primary',
  compact = false,
  sx,
}: EcommerceCoreLoaderProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const metrics = SIZE_MAP[size];
  const main =
    tone === 'secondary'
      ? theme.palette.secondary.main
      : tone === 'neutral'
        ? theme.palette.text.secondary
        : theme.palette.primary.main;
  const soft = alpha(main, isDark ? 0.18 : 0.12);

  return (
    <Stack
      role="status"
      aria-live="polite"
      spacing={compact ? 0.75 : 1.15}
      alignItems="center"
      justifyContent="center"
      sx={sx}
    >
      <Box
        sx={{
          width: metrics.mark,
          height: metrics.mark,
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          color: main,
          '@keyframes ecommerce_core-loader-float': {
            '0%, 100%': { transform: 'translateY(0) scale(1)' },
            '50%': { transform: 'translateY(-4px) scale(1.025)' },
          },
          '@keyframes ecommerce_core-loader-pulse': {
            '0%, 100%': { opacity: 0.55, transform: 'scale(0.88)' },
            '50%': { opacity: 1, transform: 'scale(1.08)' },
          },
          '@keyframes ecommerce_core-loader-trail': {
            '0%': { transform: 'translateX(8px) scale(0.78)', opacity: 0.36 },
            '50%': { transform: 'translateX(0) scale(1)', opacity: 0.92 },
            '100%': { transform: 'translateX(-8px) scale(0.78)', opacity: 0.36 },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '&, & *': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
            },
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '42% 48% 48% 54%',
            bgcolor: soft,
            border: '1px solid',
            borderColor: alpha(main, isDark ? 0.34 : 0.24),
            boxShadow: `0 14px 30px ${alpha(main, isDark ? 0.18 : 0.14)}`,
            animation: 'ecommerce_core-loader-float 1.8s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: metrics.mark * 0.48,
            height: metrics.mark * 0.34,
            borderRadius: '999px',
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.44 : 0.72),
            animation: 'ecommerce_core-loader-pulse 1.8s ease-in-out infinite',
          }}
        />
        {[0, 1, 2].map((index) => (
          <Box
            key={index}
            sx={{
              position: 'absolute',
              width: metrics.dot,
              height: metrics.dot,
              borderRadius: '50%',
              bgcolor: index === 1 ? theme.palette.secondary.main : main,
              top: `${28 + index * 14}%`,
              insetInlineEnd: `${-3 + index * 7}%`,
              animation: 'ecommerce_core-loader-trail 1.35s ease-in-out infinite',
              animationDelay: `${index * 120}ms`,
            }}
          />
        ))}
      </Box>
      {label ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: metrics.font, fontWeight: 800, textAlign: 'center' }}
        >
          {label}
        </Typography>
      ) : null}
    </Stack>
  );
}
