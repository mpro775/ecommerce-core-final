import { PERMISSIONS } from './permission.constants';

export const TEAM_ROLE_CODES = [
  'general_manager',
  'order_manager',
  'product_manager',
  'inventory_manager',
  'customer_support',
  'marketing_manager',
  'accountant',
  'viewer',
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

const ORDER_MANAGER_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.ordersRead,
  PERMISSIONS.ordersWrite,
  PERMISSIONS.shippingRead,
  PERMISSIONS.shippingWrite,
  PERMISSIONS.paymentsRead,
  PERMISSIONS.paymentsWrite,
  PERMISSIONS.customersRead,
];

const INVENTORY_MANAGER_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.inventoryRead,
  PERMISSIONS.inventoryWrite,
  PERMISSIONS.productsRead,
];

const CUSTOMER_SUPPORT_PERMISSIONS = [
  PERMISSIONS.customersRead,
  PERMISSIONS.customersWrite,
  PERMISSIONS.ordersRead,
  PERMISSIONS.reviewsRead,
  PERMISSIONS.notificationsRead,
];

const MARKETING_MANAGER_PERMISSIONS = [
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

const ACCOUNTANT_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.ordersRead,
  PERMISSIONS.paymentsRead,
  PERMISSIONS.reportsRead,
  PERMISSIONS.reportsExport,
  PERMISSIONS.billingRead,
  PERMISSIONS.customersRead,
  PERMISSIONS.affiliatesRead,
];

const VIEWER_PERMISSIONS = [
  PERMISSIONS.dashboardRead,
  PERMISSIONS.ordersRead,
  PERMISSIONS.productsRead,
  PERMISSIONS.customersRead,
  PERMISSIONS.reportsRead,
  PERMISSIONS.analyticsRead,
  PERMISSIONS.inventoryRead,
];

const GENERAL_MANAGER_PERMISSIONS = [
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
    code: 'general_manager',
    label: 'مدير عام',
    description: 'صلاحيات تشغيل شاملة للمتجر باستثناء الصلاحيات الخاصة بالمالك.',
    defaultPermissions: GENERAL_MANAGER_PERMISSIONS,
    allowedPermissions: GENERAL_MANAGER_PERMISSIONS,
  },
  {
    code: 'order_manager',
    label: 'مدير طلبات',
    description: 'إدارة الطلبات، الشحن، والمدفوعات.',
    defaultPermissions: ORDER_MANAGER_PERMISSIONS,
    allowedPermissions: ORDER_MANAGER_PERMISSIONS,
  },
  {
    code: 'product_manager',
    label: 'مدير منتجات',
    description: 'إدارة الكتالوج، المنتجات، التصنيفات، والعلامات التجارية.',
    defaultPermissions: CATALOG_PERMISSIONS,
    allowedPermissions: CATALOG_PERMISSIONS,
  },
  {
    code: 'inventory_manager',
    label: 'مدير مخزون',
    description: 'متابعة وإدارة المخزون.',
    defaultPermissions: INVENTORY_MANAGER_PERMISSIONS,
    allowedPermissions: INVENTORY_MANAGER_PERMISSIONS,
  },
  {
    code: 'customer_support',
    label: 'دعم العملاء',
    description: 'متابعة العملاء، قراءة الطلبات، والتعامل مع الدعم.',
    defaultPermissions: CUSTOMER_SUPPORT_PERMISSIONS,
    allowedPermissions: CUSTOMER_SUPPORT_PERMISSIONS,
  },
  {
    code: 'marketing_manager',
    label: 'مدير تسويق',
    description: 'إدارة العروض الترويجية، تحسين محركات البحث، والحملات.',
    defaultPermissions: MARKETING_MANAGER_PERMISSIONS,
    allowedPermissions: MARKETING_MANAGER_PERMISSIONS,
  },
  {
    code: 'accountant',
    label: 'محاسب',
    description: 'التقارير المالية، الفواتير، وقراءة الطلبات.',
    defaultPermissions: ACCOUNTANT_PERMISSIONS,
    allowedPermissions: ACCOUNTANT_PERMISSIONS,
  },
  {
    code: 'viewer',
    label: 'مشاهد',
    description: 'صلاحية قراءة فقط لمعظم أقسام المتجر.',
    defaultPermissions: VIEWER_PERMISSIONS,
    allowedPermissions: VIEWER_PERMISSIONS,
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
