export const FILTER_TYPES = ['checkbox', 'radio', 'color', 'range'] as const;

export type FilterType = (typeof FILTER_TYPES)[number];

export const FILTER_SOURCE_TYPES = [
  'manual',
  'brand',
  'attribute',
  'price',
  'warehouse',
  'availability',
] as const;

export type FilterSourceType = (typeof FILTER_SOURCE_TYPES)[number];

export const DISPLAY_TYPES = ['checkbox', 'radio', 'color', 'range', 'toggle'] as const;

export type DisplayType = (typeof DISPLAY_TYPES)[number];
