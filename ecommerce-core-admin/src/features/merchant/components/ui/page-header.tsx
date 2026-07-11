import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badgeIcon?: ReactNode;
  badgeLabel?: ReactNode | null;
  sticky?: boolean;
  stickyTop?: number | string | Record<string, number | string>;
}

export function PageHeader({
  title,
  description,
  actions,
  badgeIcon,
  badgeLabel = null,
  sticky = false,
  stickyTop = 0,
}: PageHeaderProps) {
  const showBadge = Boolean(badgeIcon) || badgeLabel !== null;

  return (
    <Box
      sx={{
        position: sticky ? 'sticky' : 'relative',
        top: sticky ? stickyTop : undefined,
        zIndex: sticky ? (theme) => theme.zIndex.appBar - 1 : undefined,
        minHeight: 104,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        p: { xs: 2, md: 2.5 },
        borderRadius: { xs: 3, md: 4 },
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.11 : 0.58),
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.glassDark
            : ADMIN_TOKENS.surfaces.glassLight,
        backdropFilter: 'blur(20px)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 18px 38px rgba(9, 7, 16, 0.22), inset 0 1px 0 rgba(255,255,255,0.035)'
            : ADMIN_TOKENS.elevation.glass,
      }}
    >
      <Stack spacing={0.85}>
        {showBadge ? (
          <Box
            sx={{
              width: 'fit-content',
              minWidth: badgeLabel === null ? 38 : undefined,
              height: 32,
              px: badgeLabel === null ? 0 : 1.3,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              color: (theme) => (theme.palette.mode === 'dark' ? 'primary.main' : 'primary.dark'),
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.07)
                  : alpha(theme.palette.secondary.main, 0.18),
              fontWeight: 900,
            }}
          >
            {badgeIcon}
            {badgeLabel !== null ? (
              <Typography component="span" variant="caption" fontWeight={900}>
                {badgeLabel}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        <Typography
          variant="h4"
          sx={{ color: 'text.primary', fontWeight: 900, letterSpacing: 0, lineHeight: 1.25 }}
        >
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ maxWidth: 820, lineHeight: 1.75 }}>
            {description}
          </Typography>
        ) : null}
      </Stack>
      {actions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}
