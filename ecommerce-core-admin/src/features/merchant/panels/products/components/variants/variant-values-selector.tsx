import { Box, Chip, Stack, Typography } from '@mui/material';
import type { Attribute } from '../../../../types';

interface VariantValuesSelectorProps {
  attributes: Attribute[];
  selectedAttributeIds: string[];
  selectedValueIdsByAttributeId: Record<string, string[]>;
  onToggleValue: (attributeId: string, valueId: string, selected: boolean) => void;
}

export function VariantValuesSelector({
  attributes,
  selectedAttributeIds,
  selectedValueIdsByAttributeId,
  onToggleValue,
}: VariantValuesSelectorProps) {
  const selectedAttributes = attributes.filter((a) => selectedAttributeIds.includes(a.id));

  if (selectedAttributes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        اختر الخصائص أولاً لتحديد القيم.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {selectedAttributes.map((attribute) => {
        const activeValues = (attribute.values ?? []).filter((v) => v.isActive);
        const selectedIds = selectedValueIdsByAttributeId[attribute.id] ?? [];

        return (
          <Box key={attribute.id}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={800}>
                {attribute.nameAr ?? attribute.name}
              </Typography>
              <Chip
                size="small"
                label={`${selectedIds.length} من ${activeValues.length}`}
                color={selectedIds.length > 0 ? 'primary' : 'default'}
                variant="outlined"
              />
            </Stack>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {activeValues.map((value) => {
                const isSelected = selectedIds.includes(value.id);
                return (
                  <Chip
                    key={value.id}
                    label={value.valueAr || value.value}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color={isSelected ? 'primary' : 'default'}
                    onClick={() => onToggleValue(attribute.id, value.id, !isSelected)}
                    sx={{
                      fontWeight: isSelected ? 800 : 400,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
