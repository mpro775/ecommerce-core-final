import { Box, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface DataTableWrapperProps {
  children: ReactNode;
  label?: string;
}

export function DataTableWrapper({ children, label = 'جدول بيانات لوحة التاجر' }: DataTableWrapperProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: `${ADMIN_TOKENS.radius.xxl}px`,
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.12 : 0.68),
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.tableDark
            : ADMIN_TOKENS.surfaces.tableLight,
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 18px 38px rgba(9, 7, 16, 0.22), inset 0 1px 0 rgba(255,255,255,0.035)'
            : ADMIN_TOKENS.elevation.glass,
      }}
    >
      <Box sx={{ width: '100%', overflowX: 'auto' }} role="region" aria-label={label}>
        {children}
      </Box>
    </Paper>
  );
}
