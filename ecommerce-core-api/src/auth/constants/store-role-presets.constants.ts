import { PERMISSIONS } from './permission.constants';

export const TEAM_ROLE_CODES = [
  'manager',
  'operations',
  'catalog',
  'support',
  'finance',
  'internal_marketing',
] as const;

export type TeamRole = (typeof TEAM_ROLE_CODES)[number];
export type StoreRole = 'owner' | TeamRole;

export interface StoreRolePreset {
  code: TeamRole;
  label: string;
  description: string;
  defaultPermissions: string[];
  allowedPermissions: string[];
}

const CATALOG_PERMISSIONS = [
  PERMISSIONS.categoriesRead,
  PERMISSIONS.categoriesWrite,
  PERMISSIONS.brandsRead,
  PERMISSIONS.brandsWrite,
  PERMISSIONS.productsRead,
  PERMISSIONS.productsWrite,
  PERMISSIONS.inventoryRead,
  PERMISSIONS.inventoryWrite,
  PERMISSIONS.attributesRead,
  PERMISSIONS.attributesWrite,
  PERMISSIONS.filtersRead,
  PERMISSIONS.filtersWrite,
  PERMISSIONS.mediaWrite,
];

const OPERATIONS_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.ordersRead,
  PERMISSIONS.ordersWrite,
  PERMISSIONS.inventoryRead,
  PERMISSIONS.inventoryWrite,
  PERMISSIONS.productsRead,
  PERMISSIONS.productsWrite,
  PERMISSIONS.customersRead,
  PERMISSIONS.customersWrite,
  PERMISSIONS.shippingRead,
  PERMISSIONS.shippingWrite,
  PERMISSIONS.paymentsRead,
  PERMISSIONS.paymentsWrite,
];

const CUSTOMER_SUPPORT_PERMISSIONS = [
  PERMISSIONS.customersRead,
  PERMISSIONS.customersWrite,
  PERMISSIONS.ordersRead,
  PERMISSIONS.reviewsRead,
  PERMISSIONS.notificationsRead,
];

const FINANCE_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.ordersRead,
  PERMISSIONS.paymentsRead,
  PERMISSIONS.reportsRead,
  PERMISSIONS.reportsExport,
  PERMISSIONS.billingRead,
  PERMISSIONS.customersRead,
  PERMISSIONS.affiliatesRead,
];

const INTERNAL_MARKETING_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.productsRead,
  PERMISSIONS.categoriesRead,
  PERMISSIONS.brandsRead,
  PERMISSIONS.customersRead,
  PERMISSIONS.promotionsRead,
  PERMISSIONS.promotionsWrite,
  PERMISSIONS.analyticsRead,
  PERMISSIONS.seoRead,
  PERMISSIONS.seoWrite,
  PERMISSIONS.pagesRead,
  PERMISSIONS.pagesWrite,
  PERMISSIONS.notificationsRead,
  PERMISSIONS.notificationsWrite,
  PERMISSIONS.themesRead,
  PERMISSIONS.affiliatesRead,
];

const MANAGER_ALLOWED_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.storeRead,
  PERMISSIONS.storeWrite,
  PERMISSIONS.settingsRead,
  PERMISSIONS.settingsWrite,
  PERMISSIONS.teamRead,
  PERMISSIONS.teamWrite,
  PERMISSIONS.usersRead,
  PERMISSIONS.usersWrite,
  ...CATALOG_PERMISSIONS,
  PERMISSIONS.ordersRead,
  PERMISSIONS.ordersWrite,
  PERMISSIONS.customersRead,
  PERMISSIONS.customersWrite,
  PERMISSIONS.shippingRead,
  PERMISSIONS.shippingWrite,
  PERMISSIONS.paymentsRead,
  PERMISSIONS.paymentsWrite,
  PERMISSIONS.promotionsRead,
  PERMISSIONS.promotionsWrite,
  PERMISSIONS.reportsRead,
  PERMISSIONS.reportsExport,
  PERMISSIONS.analyticsRead,
  PERMISSIONS.seoRead,
  PERMISSIONS.seoWrite,
  PERMISSIONS.pagesRead,
  PERMISSIONS.pagesWrite,
  PERMISSIONS.notificationsRead,
  PERMISSIONS.notificationsWrite,
  PERMISSIONS.webhooksRead,
  PERMISSIONS.webhooksWrite,
  PERMISSIONS.reviewsRead,
  PERMISSIONS.reviewsWrite,
  PERMISSIONS.billingRead,
  PERMISSIONS.affiliatesRead,
  PERMISSIONS.affiliatesWrite,
  PERMISSIONS.loyaltyRead,
  PERMISSIONS.loyaltyWrite,
  PERMISSIONS.loyaltyAdjust,
  PERMISSIONS.themesRead,
  PERMISSIONS.themesWrite,
  PERMISSIONS.themesPublish,
  PERMISSIONS.themesRollback,
  PERMISSIONS.domainsRead,
  PERMISSIONS.domainsWrite,
];

export const STORE_ROLE_PRESETS: StoreRolePreset[] = [
  {
    code: 'manager',
    label: 'مدير',
    description: 'صلاحيات تشغيل عالية لمعظم أقسام المتجر بدون صلاحية المالك الكاملة.',
    defaultPermissions: MANAGER_ALLOWED_PERMISSIONS,
    allowedPermissions: MANAGER_ALLOWED_PERMISSIONS,
  },
  {
    code: 'operations',
    label: 'عمليات',
    description: 'إدارة الطلبات والمخزون والعملاء والمنتجات اليومية.',
    defaultPermissions: OPERATIONS_PERMISSIONS,
    allowedPermissions: OPERATIONS_PERMISSIONS,
  },
  {
    code: 'catalog',
    label: 'كتالوج',
    description: 'إدارة المنتجات والتصنيفات والعلامات والخصائص والوسائط.',
    defaultPermissions: CATALOG_PERMISSIONS,
    allowedPermissions: CATALOG_PERMISSIONS,
  },
  {
    code: 'support',
    label: 'دعم العملاء',
    description: 'متابعة العملاء وقراءة الطلبات والتعامل مع طلبات الدعم.',
    defaultPermissions: CUSTOMER_SUPPORT_PERMISSIONS,
    allowedPermissions: CUSTOMER_SUPPORT_PERMISSIONS,
  },
  {
    code: 'finance',
    label: 'مالي',
    description: 'قراءة الطلبات والتقارير والعمولات دون تعديل فريق العمل.',
    defaultPermissions: FINANCE_PERMISSIONS,
    allowedPermissions: FINANCE_PERMISSIONS,
  },
  {
    code: 'internal_marketing',
    label: 'تسويق داخلي',
    description: 'متابعة التسويق الداخلي والتحليلات دون إنشاء حسابات مسوقين بالعمولة.',
    defaultPermissions: INTERNAL_MARKETING_PERMISSIONS,
    allowedPermissions: INTERNAL_MARKETING_PERMISSIONS,
  },
];

const TEAM_ROLE_SET = new Set<string>(TEAM_ROLE_CODES);
const ROLE_PRESET_MAP = new Map(STORE_ROLE_PRESETS.map((preset) => [preset.code, preset]));

export function isTeamRole(role: string): role is TeamRole {
  return TEAM_ROLE_SET.has(role);
}

export function getStoreRolePreset(role: TeamRole): StoreRolePreset {
  const preset = ROLE_PRESET_MAP.get(role);
  if (!preset) {
    throw new Error(`Unknown team role: ${role}`);
  }
  return preset;
}
