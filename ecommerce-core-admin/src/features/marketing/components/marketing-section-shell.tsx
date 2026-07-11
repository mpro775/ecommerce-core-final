import { Box, Container, Typography, type ContainerProps } from '@mui/material';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import { type ReactNode } from 'react';
import { EcommerceCorePatternLayer } from '../../../components/ecommerce_core-pattern-layer';
import { RevealOnScroll } from './marketing-motion';
import type { MarketingMascotSceneId } from './marketing-mascot-scenes';

interface MarketingSectionShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  id?: string;
  mascotAnchor?: 'start' | 'center' | 'end';
  mascotScene?: MarketingMascotSceneId;
  snapScene?: boolean;
  children: ReactNode;
  maxWidth?: ContainerProps['maxWidth'];
  surface?: 'default' | 'paper' | 'panel';
  pattern?: false | 'hero' | 'dashboard' | 'section' | 'card';
  patternAnchor?: 'start' | 'end' | 'center';
  patternOpacity?: number;
  sx?: SxProps<Theme>;
}

export function MarketingSectionShell({
  eyebrow,
  title,
  description,
  id,
  mascotAnchor,
  mascotScene,
  snapScene,
  children,
  maxWidth = 'lg',
  surface = 'default',
  pattern,
  patternAnchor = 'center',
  patternOpacity,
  sx,
}: MarketingSectionShellProps) {
  const theme = useTheme();
  const isPaper = surface === 'paper';
  const isPanel = surface === 'panel';
  const resolvedPattern = pattern === undefined ? (surface === 'default' ? false : 'section') : pattern;
  const resolvedPatternOpacity =
    patternOpacity ?? (theme.palette.mode === 'dark' ? (isPanel ? 0.34 : 0.28) : isPanel ? 0.46 : 0.36);

  return (
    <Box
      component="section"
      id={id}
      data-mascot-anchor={mascotAnchor}
      data-mascot-scene={mascotScene}
      data-marketing-snap-scene={(snapScene ?? Boolean(mascotScene)) ? 'true' : undefined}
      sx={[
        {
          position: 'relative',
          overflow: 'hidden',
          py: { xs: 8, md: 12 },
          bgcolor: isPaper ? 'background.paper' : 'background.default',
          backgroundImage: isPanel
            ? theme.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.035)} 0%, transparent 58%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.secondary.light, 0.24)} 0%, transparent 58%)`
            : 'none',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {resolvedPattern ? (
        <EcommerceCorePatternLayer
          variant={resolvedPattern}
          anchor={patternAnchor}
          opacity={resolvedPatternOpacity}
          sx={{
            insetBlockStart: '-8%',
            insetBlockEnd: '-6%',
            maskImage: 'linear-gradient(180deg, transparent 0%, black 16%, black 84%, transparent 100%)',
          }}
        />
      ) : null}

      <Container maxWidth={maxWidth} sx={{ position: 'relative', zIndex: 1 }}>
        <RevealOnScroll>
          <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 }, maxWidth: 760, mx: 'auto' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'primary.main',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1.4,
                py: 0.7,
                mb: 1.6,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.16),
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.06),
                fontWeight: 800,
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              variant="h2"
              sx={{
                mb: description ? 2 : 0,
                color: 'text.primary',
                fontSize: { xs: '2rem', md: '2.65rem' },
                lineHeight: 1.18,
              }}
            >
              {title}
            </Typography>
            {description ? (
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ mx: 'auto', maxWidth: 700, fontWeight: 500, lineHeight: 1.75 }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>
        </RevealOnScroll>

        {children}
      </Container>
    </Box>
  );
}
