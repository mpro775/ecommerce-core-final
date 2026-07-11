import { Box, Chip, Stack, Typography } from '@mui/material';

interface ProductDescriptionEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  dir?: 'rtl' | 'ltr';
  minRows?: number;
  maxLength?: number;
}

export function ProductDescriptionEditor({
  label,
  value,
  onChange,
  error,
  dir = 'rtl',
  minRows = 8,
  maxLength = 250,
}: ProductDescriptionEditorProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const remainingChars = Math.max(maxLength - value.length, 0);

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="subtitle2" fontWeight={800}>
          {label}
        </Typography>
        <Chip size="small" label={`${wordCount} كلمة`} variant="outlined" />
      </Stack>
      <Box
        sx={{
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{
            minHeight: 44,
            px: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.secondary',
          }}
        >
          <Typography variant="caption" fontWeight={800}>
            محرر نص بسيط
          </Typography>
          <Typography variant="caption" color={remainingChars < 20 ? 'warning.main' : 'text.secondary'}>
            متبقي {remainingChars} حرف
          </Typography>
        </Stack>
        <Box
          component="textarea"
          value={value}
          dir={dir}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          rows={minRows}
          sx={{
            display: 'block',
            width: '100%',
            minHeight: minRows * 34,
            p: 2,
            resize: 'vertical',
            border: 0,
            outline: 0,
            bgcolor: 'transparent',
            color: 'text.primary',
            font: 'inherit',
            lineHeight: 1.8,
          }}
        />
        <Box sx={{ px: 2, py: 0.75, color: 'text.secondary', fontWeight: 700 }}>
          اكتب وصفًا واضحًا ومباشرًا. يمكن تعديله قبل النشر.
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" align="left" dir="ltr">
        {value.length} / {maxLength} characters
      </Typography>
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}

