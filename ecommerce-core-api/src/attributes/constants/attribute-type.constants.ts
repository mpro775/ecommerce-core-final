export const ATTRIBUTE_TYPES = ['dropdown', 'color'] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
