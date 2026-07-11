import { Paper, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface FilterBarProps {
  children: ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: `${ADMIN_TOKENS.radius.xxl}px`,
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.12 : 0.68),
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.glassDark
            : ADMIN_TOKENS.surfaces.glassLight,
        backdropFilter: 'blur(20px)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 14px 30px rgba(9, 7, 16, 0.16), inset 0 1px 0 rgba(255,255,255,0.035)'
            : 'none',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        {children}
      </Stack>
    </Paper>
  );
}
