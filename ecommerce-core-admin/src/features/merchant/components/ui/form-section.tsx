import { Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { SectionCard } from './section-card';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <SectionCard title={title} {...(description ? { description } : {})}>
      <Stack spacing={3}>{children}</Stack>
    </SectionCard>
  );
}
