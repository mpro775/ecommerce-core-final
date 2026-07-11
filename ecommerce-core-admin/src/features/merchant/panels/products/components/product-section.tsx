import { ExpandMoreIcon } from '../../../../../components/icons';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';

interface ProductSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  expanded: boolean;
  onChange: () => void;
  children: ReactNode;
  order?: number;
  collapsible?: boolean;
}

export function ProductSection({
  title,
  description,
  icon,
  expanded,
  onChange,
  children,
  order,
  collapsible = true,
}: ProductSectionProps) {
  const header = (
    <Stack direction="row" spacing={1.25} alignItems="center">
      {icon}
      <Box>
        <Typography variant="h6" fontWeight={900}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );

  if (!collapsible) {
    return (
      <Paper
        elevation={0}
        sx={{
          order,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2.25 }}>{header}</Box>
        <Divider />
        <Box sx={{ px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 } }}>{children}</Box>
      </Paper>
    );
  }

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={onChange}
      sx={{
        order,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { my: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: { xs: 2.5, md: 3 },
          py: 2,
          minHeight: 72,
          '&.Mui-expanded': { minHeight: 72 },
          '& .MuiAccordionSummary-content': {
            my: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          },
        }}
      >
        {header}
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 2.5, md: 3 }, pb: { xs: 2.5, md: 3 }, pt: 0 }}>
        <Divider sx={{ mb: 3 }} />
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
