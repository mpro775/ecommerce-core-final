import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { Attribute } from '../../../../types';

interface VariantAttributePickerProps {
  attributes: Attribute[];
  selectedAttributeIds: string[];
  onToggleAttribute: (attributeId: string, selected: boolean) => void;
}

export function VariantAttributePicker({
  attributes,
  selectedAttributeIds,
  onToggleAttribute,
}: VariantAttributePickerProps) {
  if (attributes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        لم يتم إنشاء خصائص بعد.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
      {attributes.map((attribute) => {
        const isSelected = selectedAttributeIds.includes(attribute.id);
        const activeValues = (attribute.values ?? []).filter((v) => v.isActive);
        return (
          <Paper
            key={attribute.id}
            elevation={0}
            onClick={() => onToggleAttribute(attribute.id, !isSelected)}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: isSelected ? 'primary.main' : 'divider',
              bgcolor: isSelected ? 'primary.50' : 'background.paper',
              cursor: 'pointer',
              transition: 'border-color 160ms ease, background-color 160ms ease',
              '&:hover': {
                borderColor: isSelected ? 'primary.main' : 'action.hover',
              },
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="subtitle2" fontWeight={800}>
                {attribute.nameAr ?? attribute.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`${activeValues.length} قيمة متاحة`}
                  variant="outlined"
                />
                {isSelected ? (
                  <Chip
                    size="small"
                    label="محددة"
                    color="primary"
                  />
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}
