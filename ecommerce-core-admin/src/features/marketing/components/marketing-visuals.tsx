import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useId, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll, getReducedMotionSx, marketingPulseLine } from './marketing-motion';

type VisualTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export interface MarketingChartDatum {
  name: string;
  value: number;
  secondary?: number;
}

export interface MarketingFlowItem {
  label: string;
  caption: string;
  icon: ReactNode;
  tone?: VisualTone;
}

function getToneColor(tone: VisualTone, theme: Theme) {
  return theme.palette[tone].main;
}

export function MarketingBrowserFrame({
  children,
  title,
  minHeight = 320,
}: {
  children: ReactNode;
  title: string;
  minHeight?: number;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.72 : 0.92),
        borderRadius: 2,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha('#20212A', 0.98)
            : alpha(theme.palette.background.paper, 0.92),
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 22px 54px rgba(0, 0, 0, 0.32)'
            : '0 22px 54px rgba(80, 46, 145, 0.12)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          px: 1.5,
          py: 1.15,
        }}
      >
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#FF6B6B' }} />
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#F2B84B' }} />
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#4BD08C' }} />
        <Typography
          variant="caption"
          dir="ltr"
          sx={{
            mr: 'auto',
            color: 'text.secondary',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ minHeight }}>{children}</Box>
    </Box>
  );
}

export function MarketingMetricCard({
  caption,
  icon,
  label,
  tone = 'primary',
  value,
}: {
  caption?: string;
  icon?: ReactNode;
  label: string;
  tone?: VisualTone;
  value: string;
}) {
  const theme = useTheme();
  const color = getToneColor(tone, theme);

  return (
    <Box
      sx={{
        minHeight: 112,
        p: 1.7,
        borderRadius: 1.2,
        border: '1px solid',
        borderColor: alpha(color, 0.2),
        bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.08 : 0.055),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          insetInlineEnd: -22,
          bottom: -26,
          width: 86,
          height: 86,
          borderRadius: '50%',
          bgcolor: alpha(color, 0.09),
        }}
      />
      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 1, position: 'relative' }}>
        {icon ? (
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              color,
              bgcolor: alpha(color, 0.12),
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        ) : null}
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="h4" sx={{ color, fontWeight: 900, position: 'relative' }}>
        {value}
      </Typography>
      {caption ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.7, lineHeight: 1.55, position: 'relative' }}
        >
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}

export function MarketingMiniChart({
  color,
  data,
  secondaryColor,
  type = 'area',
}: {
  color?: string;
  data: readonly MarketingChartDatum[];
  secondaryColor?: string;
  type?: 'area' | 'bar';
}) {
  const theme = useTheme();
  const { direction } = useMarketingLocale();
  const gradientId = useId().replace(/:/g, '');
  const mainColor = color ?? theme.palette.primary.main;
  const accentColor = secondaryColor ?? theme.palette.secondary.main;
  const gridColor = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.1);
  const tickColor = theme.palette.text.secondary;
  const hasSecondarySeries = data.some((item) => typeof item.secondary === 'number');

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: alpha(mainColor, 0.08) }}
            contentStyle={{
              background: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 10,
              boxShadow: ADMIN_TOKENS.elevation.sm,
              direction,
            }}
          />
          <Bar dataKey="value" fill={mainColor} radius={[8, 8, 2, 2]} />
          {hasSecondarySeries ? <Bar dataKey="secondary" fill={accentColor} radius={[8, 8, 2, 2]} /> : null}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={[...data]} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor={mainColor} stopOpacity={0.32} />
            <stop offset="95%" stopColor={mainColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: tickColor, fontSize: 11 }} />
        <YAxis hide />
        <Tooltip
          cursor={{ stroke: alpha(mainColor, 0.22), strokeWidth: 2 }}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 10,
            boxShadow: ADMIN_TOKENS.elevation.sm,
            direction,
          }}
        />
        <Area dataKey="value" fill={`url(#${gradientId})`} stroke={mainColor} strokeWidth={3} type="monotone" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MarketingVisualFlow({ items }: { items: MarketingFlowItem[] }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'relative',
        '&::before': {
          content: '""',
          display: { xs: 'none', md: 'block' },
          position: 'absolute',
          top: 40,
          insetInlineStart: '7%',
          width: '86%',
          height: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.16),
        },
        '&::after': {
          animation: `${marketingPulseLine} 4.6s ease-in-out infinite`,
          bgcolor: theme.palette.secondary.main,
          content: '""',
          display: { xs: 'none', md: 'block' },
          height: 2,
          insetInlineStart: '12%',
          position: 'absolute',
          top: 40,
          width: '32%',
          ...getReducedMotionSx(),
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.max(items.length, 1)}, 1fr)` },
          gap: { xs: 1.3, md: 1.1 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {items.map((item, index) => {
          const tone = item.tone ?? 'primary';
          const color = getToneColor(tone, theme);

          return (
            <RevealOnScroll key={item.label} delay={index * 70}>
              <Box
                sx={{
                  minHeight: { xs: 108, md: 188 },
                  p: { xs: 1.6, md: 1.8 },
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: index === items.length - 1 ? alpha(color, 0.34) : 'divider',
                  bgcolor:
                    index === items.length - 1
                      ? alpha(color, theme.palette.mode === 'dark' ? 0.1 : 0.065)
                      : alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.54 : 0.74),
                }}
              >
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    mb: 1.4,
                    mx: { xs: 0, md: 'auto' },
                    display: 'grid',
                    placeItems: 'center',
                    color,
                    bgcolor: alpha(color, 0.12),
                    border: '1px solid',
                    borderColor: alpha(color, 0.22),
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, textAlign: { xs: 'start', md: 'center' }, mb: 0.7 }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', lineHeight: 1.6, textAlign: { xs: 'start', md: 'center' } }}
                >
                  {item.caption}
                </Typography>
              </Box>
            </RevealOnScroll>
          );
        })}
      </Box>
    </Box>
  );
}
