import { Box, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../../theme/tokens';

interface AppPageProps {
  children: ReactNode;
  maxWidth?: number;
}

export function AppPage({
  children,
  maxWidth = ADMIN_TOKENS.layout.contentMaxWidth,
}: AppPageProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth,
        mx: 'auto',
        p: { xs: 0.25, md: 0.5 },
        borderRadius: { xs: 3, md: 5 },
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? ADMIN_TOKENS.surfaces.heroDark
            : ADMIN_TOKENS.surfaces.heroLight,
      }}
    >
      <Stack spacing={{ xs: 2, md: 2.5 }}>{children}</Stack>
    </Box>
  );
}
