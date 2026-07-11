import type { ProductStatus } from '../../types';

export const productStatusColors: Record<
  ProductStatus,
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
  draft: 'default',
  active: 'success',
  archived: 'warning',
};

export const productStatusLabels: Record<ProductStatus, string> = {
  draft: 'مسودة',
  active: 'نشط',
  archived: 'مؤرشف',
};
