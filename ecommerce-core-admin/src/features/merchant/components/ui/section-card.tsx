import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  dense?: boolean;
  sx?: SxProps<Theme>;
}

export function SectionCard({
  title,
  subtitle,
  description,
  actions,
  children,
  dense = false,
  sx,
}: SectionCardProps) {
  const supportingText = subtitle ?? description;

  return (
    <Paper
      elevation={0}
      sx={{
        p: dense ? 2 : { xs: 2.5, md: 3 },
        borderRadius: `${dense ? ADMIN_TOKENS.radius.xl : ADMIN_TOKENS.radius.xxl}px`,
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.12 : 0.68),
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.tableDark
            : ADMIN_TOKENS.surfaces.tableLight,
        backdropFilter: 'blur(20px)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 18px 38px rgba(9, 7, 16, 0.22), inset 0 1px 0 rgba(255,255,255,0.035)'
            : '0 18px 38px rgba(80, 46, 145, 0.08)',
        '&:hover': {
          borderColor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.16)
              : alpha(theme.palette.primary.main, 0.18),
        },
        ...sx,
      }}
    >
      {title ? (
        <Box
          sx={{
            mb: 2.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            {supportingText ? (
              <Typography variant="body2" color="text.secondary">
                {supportingText}
              </Typography>
            ) : null}
          </Stack>
          {actions}
        </Box>
      ) : null}
      {children}
    </Paper>
  );
}
