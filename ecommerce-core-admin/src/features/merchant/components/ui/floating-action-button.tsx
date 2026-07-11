import { Box, Button } from '@mui/material';
import type { ReactNode } from 'react';

interface FloatingActionButtonProps {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export function FloatingActionButton({
  label,
  icon,
  disabled = false,
  onClick,
}: FloatingActionButtonProps) {
  return (
    <Box
      sx={{
        position: 'fixed',
        insetInlineEnd: { xs: 16, md: 28 },
        bottom: { xs: 84, md: 28 },
        zIndex: (theme) => theme.zIndex.speedDial,
        pointerEvents: 'none',
      }}
    >
      <Button
        variant="contained"
        size="large"
        startIcon={icon}
        disabled={disabled}
        onClick={onClick}
        sx={{
          pointerEvents: 'auto',
          minHeight: 52,
          px: 3,
          borderRadius: 999,
          fontWeight: 900,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 18px 38px rgba(0,0,0,0.36)'
              : '0 18px 38px rgba(80,46,145,0.24)',
          '& .MuiButton-startIcon': {
            marginInlineEnd: 1,
          },
        }}
      >
        {label}
      </Button>
    </Box>
  );
}
