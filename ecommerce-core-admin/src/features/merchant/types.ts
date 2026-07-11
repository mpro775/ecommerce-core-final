export type TeamRole =
  | 'manager'
  | 'operations'
  | 'catalog'
  | 'support'
  | 'finance'
  | 'internal_marketing';

export type StoreRole = 'owner' | TeamRole;

export interface StoreRolePreset {
  code: TeamRole;
  label: string;
  description: string;
  defaultPermissions: string[];
  allowedPermissions: string[];
}

export interface MerchantUser {
  id: string;
  storeId: string;
  email: string;
  fullName: string;
  role: StoreRole;
  permissions: string[];
  sessionId: string;
  onboardingCompleted: boolean;
}

export interface MerchantSession {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken: string;
  user: MerchantUser;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: MerchantUser;
}

export interface StoreSettings {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  description: string | null;
  slug: string;
  logoMediaAssetId: string | null;
  logoUrl: string | null;
  faviconMediaAssetId: string | null;
  faviconUrl: string | null;
  businessCategory: string | null;
  onboardingCompleted: boolean;
  phone: string | null;
  address: string | null;
  country: string;
  city: string | null;
  addressDetails: string | null;
  latitude: number | null;
  longitude: number | null;
  workingHours: Array<{
    day: string;
    isClosed: boolean;
    slots: Array<{ open: string; close: string }>;
  }>;
  socialLinks: Record<string, string | null>;
  currencyCode: string;
  baseCurrencyCode: string;
  defaultCurrencyCode: string;
  currencies: StoreCurrency[];
  timezone: string;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  loyaltyPolicy: string | null;
}

export type SetupStepStatus = 'completed' | 'skipped' | 'missing' | 'warning' | 'blocking';

export interface StoreReadinessStep {
  key: string;
  title: string;
  description: string;
  status: SetupStepStatus;
  required: boolean;
  skippable: boolean;
  actionLabel: string;
  actionTab: string;
  quickAction: string | null;
}

export interface StoreReadinessSection {
  key: string;
  title: string;
  weight: number;
  completedSteps: number;
  totalSteps: number;
  status: SetupStepStatus;
  steps: StoreReadinessStep[];
}

export interface StoreReadiness {
  score: number;
  status: 'ready' | 'needs_attention' | 'not_ready';
  canReceiveOrders: boolean;
  completedSteps: number;
  totalSteps: number;
  blockingIssues: StoreReadinessStep[];
  warnings: StoreReadinessStep[];
  nextBestAction: StoreReadinessStep | null;
  sections: StoreReadinessSection[];
}

export interface StoreCurrency {
  currencyCode: string;
  yerPerUnit: number;
  decimalDigits: number;
  roundingIncrement: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface StoreSettingsOptions {
  defaultCountry: string;
  currencies: string[];
  timezones: string[];
  governorates: string[];
  workingDays: string[];
  socialPlatforms: string[];
  businessCategories: string[];
}

export interface Category {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  mediaAssetId: string | null;
  imageUrl: string | null;
  imageAltAr: string | null;
  imageAltEn: string | null;
  backgroundMediaAssetId: string | null;
  backgroundImageUrl: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
}

export interface Brand {
  id: string;
  storeId: string;
  name: string;
  nameAr: string;
  nameEn: string | null;
  mediaAssetId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPopular: boolean;
}

export type ProductStatus = 'draft' | 'active' | 'archived';
export type ProductType = 'single' | 'bundled' | 'digital';

export interface ProductBundleItem {
  id: string;
  bundledProductId: string;
  bundledVariantId: string | null;
  quantity: number;
  sortOrder: number;
  bundledProductTitle: string;
  bundledVariantTitle: string | null;
}

export interface ProductDigitalFile {
  id: string;
  mediaAssetId: string;
  fileName: string | null;
  sortOrder: number;
  url: string;
  fileSizeBytes: number;
}

export interface ProductInlineDiscount {
  type: 'percent' | 'fixed';
  value: number;
  startsAt: string | null;
  endsAt: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  barcode: string | null;
  price: number;
  priceYER: number;
  compareAtPrice: number | null;
  compareAtPriceYER: number | null;
  currencyOverrides: Array<{
    currencyCode: string;
    price: number;
    compareAtPrice: number | null;
  }>;
  stockQuantity: number;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  attributeValueIds: string[];
  isDefault: boolean;
  titleAr: string | null;
  titleEn: string | null;
}

export type InventoryMovementType = 'adjustment' | 'sale' | 'return' | 'restock';
export type InventoryReservationStatus = 'reserved' | 'released' | 'consumed';

export interface InventoryMovement {
  id: string;
  variantId: string;
  orderId: string | null;
  warehouseId: string | null;
  movementType: InventoryMovementType;
  qtyDelta: number;
  note: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
}

export interface InventoryReservation {
  id: string;
  orderId: string;
  variantId: string;
  warehouseId: string | null;
  quantity: number;
  status: InventoryReservationStatus;
  reservedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  consumedAt: string | null;
  releaseReason: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
}

export interface InventoryVariantSnapshot {
  variantId: string;
  productId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  stockQuantity: number;
  lowStockThreshold: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface PaginatedInventoryMovements {
  items: InventoryMovement[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedInventoryReservations {
  items: InventoryReservation[];
  total: number;
  page: number;
  limit: number;
}

export interface Warehouse {
  id: string;
  storeId: string;
  name: string;
  nameAr: string;
  nameEn: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  country: string;
  city: string;
  branch: string;
  district: string;
  street: string;
  shortAddress: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  geolocation: Record<string, unknown> | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWarehouseLink {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface VariantWarehouseAllocation {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  isDefault: boolean;
  isActive: boolean;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number | null;
  reorderPoint: number | null;
}

export interface ProductImage {
  id: string;
  productId: string;
  variantId: string | null;
  mediaAssetId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string | null;
  categoryIds: string[];
  productType: ProductType;
  isVisible: boolean;
  stockUnlimited: boolean;
  questionsEnabled: boolean;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  variants?: ProductVariant[];
  images?: ProductImage[];
  bundleItems?: ProductBundleItem[];
  digitalFiles?: ProductDigitalFile[];
  relatedProductIds?: string[];
  titleAr: string | null;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  shortDescriptionAr: string | null;
  shortDescriptionEn: string | null;
  detailedDescriptionAr: string | null;
  detailedDescriptionEn: string | null;
  brand: string | null;
  brandId: string | null;
  weight: number | null;
  weightUnit: string | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  costPrice: number | null;
  productLabel: string | null;
  youtubeUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  customFields: Array<Record<string, unknown>>;
  inlineDiscount: ProductInlineDiscount | null;
  digitalDownloadAttemptsLimit: number | null;
  digitalDownloadExpiresAt: string | null;
  tags: string[];
  isFeatured: boolean;
  isTaxable: boolean;
  taxRate: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  publishedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  filterValueIds?: string[];
  filterRanges?: Array<{ filterId: string; numericValue: number }>;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface MediaAsset {
  id: string;
  storeId: string;
  bucketName: string | null;
  objectKey: string;
  url: string;
  etag: string | null;
  mimeType: string;
  fileSizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  downloadUrl?: string;
  downloadUrlExpiresAt?: string;
}

export interface PresignedMediaUpload {
  objectKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  maxFileSizeBytes: number;
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'returned';

export type PaymentMethod = string;
export type PaymentStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'refunded';
export type ManualPaymentMethodType = 'cod' | 'wallet' | 'bank_transfer' | 'exchange_transfer' | 'custom_manual';

export interface PlatformPaymentMethod {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconUrl: string | null;
  type: ManualPaymentMethodType;
  requiresReference: boolean;
  requiresReceipt: boolean;
  isReceiptOptional: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

export interface StoreSeoSettings {
  homeSeoTitleAr: string | null;
  homeSeoTitleEn: string | null;
  homeSeoDescriptionAr: string | null;
  homeSeoDescriptionEn: string | null;
  defaultSeoTitleAr: string | null;
  defaultSeoTitleEn: string | null;
  defaultSeoDescriptionAr: string | null;
  defaultSeoDescriptionEn: string | null;
  defaultOgImage: string | null;
  defaultTwitterImage: string | null;
  keywords: string[];
  googleSiteVerification: string | null;
  googleAnalyticsMeasurementId: string | null;
  bingSiteVerification: string | null;
  facebookDomainVerification: string | null;
  seoIndexEnabled: boolean;
  seoFollowDefault: boolean;
  canonicalBaseUrl: string | null;
  defaultLanguage: 'ar' | 'en';
  supportedLanguages: Array<'ar' | 'en'>;
}

export interface StorePage {
  id: string;
  slug: string;
  pageKey: 'about' | 'contact' | 'shipping_policy' | 'return_policy' | 'privacy_policy' | 'terms' | 'faq' | null;
  pageType: 'custom' | 'about' | 'contact' | 'faq' | 'policy';
  titleAr: string | null;
  titleEn: string | null;
  contentAr: string | null;
  contentEn: string | null;
  excerptAr: string | null;
  excerptEn: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  ogImage: string | null;
  faqItems: Array<Record<string, unknown>>;
  seoIndex: boolean;
  seoFollow: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePagesResponse {
  items: StorePage[];
}

export interface BootstrapStorePagesResponse {
  items: Array<{
    pageKey: NonNullable<StorePage['pageKey']>;
    status: 'created' | 'updated' | 'skipped';
    page: StorePage;
    changedFields?: string[];
  }>;
}

export interface SeoAuditResponse {
  score: number;
  counts: Record<string, number>;
  issuesTotal: number;
  recommendations: string[];
}

export interface SeoIssue {
  id: string;
  issueType: string;
  scope?: 'all' | 'home' | 'products' | 'categories' | 'pages';
  targetType: 'home' | 'product' | 'category' | 'page' | 'integration';
  targetId: string | null;
  targetTitle?: string;
  targetName?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning';
  title: string;
  description: string;
  impact?: string;
  fixMethod?: string;
  canAutoFix: boolean;
  fixAction: string;
}

export interface SeoAuditDetailsResponse {
  score: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  summary?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    fixable: number;
    manual: number;
  };
  totalIssues: number;
  autoFixableIssues: number;
  sections: Array<{
    key: string;
    label: string;
    score: number;
    issuesCount: number;
    fixableCount?: number;
    issues: SeoIssue[];
  }>;
  checklist: Array<{
    key: string;
    label: string;
    status: 'done' | 'warning' | 'error';
    priority: 'high' | 'medium' | 'low';
    action: string | null;
  }>;
}

export interface SeoSuggestionResponse {
  targetType: 'home' | 'product' | 'category' | 'page';
  targetId: string | null;
  suggestions: {
    titleAr: string;
    descriptionAr: string;
    titleEn: string;
    descriptionEn: string;
  };
}

export interface SeoAutoFixResponse {
  success: boolean;
  fixed?: number;
  skipped?: number;
  failed?: number;
  fixedCount: number;
  skippedCount: number;
  failedCount: number;
  details: Array<{
    scope?: 'home' | 'products' | 'categories' | 'pages';
    targetType: 'home' | 'product' | 'category' | 'page';
    targetId: string | null;
    targetTitle: string;
    targetName?: string;
    status: 'fixed' | 'skipped' | 'failed';
    fieldsUpdated?: string[];
    fields?: string[];
    reason?: string | null;
  }>;
}

export interface StorePaymentMethod {
  id: string;
  storeId: string;
  platformPaymentMethodId: string;
  isEnabled: boolean;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  sortOrder: number;
  platformMethod: PlatformPaymentMethod;
}

export interface Payment {
  id: string;
  storeId: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  storePaymentMethodId: string | null;
  platformPaymentMethodId: string | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  phoneNumber: string | null;
  iban: string | null;
  instructionsAr: string | null;
  instructionsEn: string | null;
  payerReference: string | null;
  payerReceiptUrl: string | null;
  payerReceiptMediaAssetId: string | null;
  payerNote: string | null;
  customerSubmittedAt: string | null;
  receiptUrl: string | null;
  receiptMediaAssetId: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  customerUploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWithOrder extends Payment {
  orderCode: string;
  orderStatus: string;
  orderTotal: number;
}

export interface Order {
  id: string;
  orderCode: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  currencyCode: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string | null;
    name: string | null;
    phone: string | null;
  };
  paymentMethod: PaymentMethod | null;
  paymentMethodCode: string | null;
  paymentMethodName: string | null;
  paymentStatus: PaymentStatus | null;
}

export interface OrderDetail extends Order {
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    title: string;
    sku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  timeline: Array<{
    from: string | null;
    to: string;
    note: string | null;
    createdAt: string;
  }>;
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    receiptUrl: string | null;
    paymentMethodCode: string | null;
    paymentMethodName: string | null;
    accountName: string | null;
    accountNumber: string | null;
    phoneNumber: string | null;
    iban: string | null;
    instructionsAr: string | null;
    instructionsEn: string | null;
    payerReference: string | null;
    payerReceiptUrl: string | null;
    payerReceiptMediaAssetId: string | null;
    payerNote: string | null;
    customerSubmittedAt: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
  } | null;
}

export type CustomerGender = 'male' | 'female' | null;

export interface ManagedCustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: CustomerGender;
  country: string;
  city: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  ordersCount: number;
  totalSpent: number;
}

export interface ManagedCustomerProfile {
  id: string;
  storeId: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: CustomerGender;
  country: string;
  city: string | null;
  birthDate: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedCustomerAbandonedCart {
  id: string;
  cartData: Record<string, unknown>;
  cartTotal: number;
  itemsCount: number;
  recoverySentAt: string | null;
  recoveredAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ManagedCustomerDetails {
  customer: ManagedCustomerProfile;
  wallet?: LoyaltyWallet | null;
  reviews: ProductReviewResponse[];
  wishlist: WishlistItemResponse[];
  addresses: CustomerAddressResponse[];
  abandonedCarts: ManagedCustomerAbandonedCart[];
  orders: CustomerOrderResponse[];
}

export interface ManagedCustomersListResponse {
  items: ManagedCustomerSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerAddressResponse {
  id: string;
  addressLine: string;
  city: string | null;
  area: string | null;
  notes: string | null;
  isDefault: boolean;
}

export interface WishlistItemResponse {
  id: string;
  productId: string;
  title: string;
  slug: string;
  primaryImageUrl: string | null;
  priceFrom: number | null;
  createdAt: string;
}

export interface ProductReviewResponse {
  id: string;
  productId: string;
  productTitle: string | null;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderResponse {
  id: string;
  orderCode: string;
  status: string;
  subtotal: number;
  total: number;
  shippingFee: number;
  discountTotal: number;
  currencyCode: string;
  createdAt: string;
}

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export interface ManagedReviewModeration {
  id: string;
  productId: string;
  productTitle: string;
  customerId: string | null;
  customerName: string;
  orderId: string | null;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  moderationStatus: ModerationStatus;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedReviewsListResponse {
  items: ManagedReviewModeration[];
  total: number;
  page: number;
  limit: number;
}

export interface ManagedProductQuestion {
  id: string;
  productId: string;
  productTitle: string;
  customerId: string | null;
  customerName: string | null;
  question: string;
  answer: string | null;
  answeredBy: string | null;
  answeredByName: string | null;
  answeredAt: string | null;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedQuestionsListResponse {
  items: ManagedProductQuestion[];
  total: number;
  page: number;
  limit: number;
}

export interface RestockOverviewResponse {
  subscribersCount: number;
  sentCount: number;
  ordersCount: number;
  salesAmount: number;
}

export interface RestockProductStatsItem {
  productId: string;
  productTitle: string;
  productSlug: string;
  subscribersCount: number;
  sentCount: number;
  ordersCount: number;
  salesAmount: number;
}

export interface RestockProductStatsListResponse {
  items: RestockProductStatsItem[];
  total: number;
  page: number;
  limit: number;
}

export type ManagedAbandonedCartStatus = 'ready' | 'sent' | 'recovered' | 'expired';

export interface ManagedAbandonedCartListItem {
  id: string;
  cartId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  cartTotal: number;
  itemsCount: number;
  recoverySentAt: string | null;
  recoveredAt: string | null;
  recoveredOrderId: string | null;
  expiresAt: string;
  createdAt: string;
  status: ManagedAbandonedCartStatus;
}

export interface ManagedAbandonedCartListResponse {
  items: ManagedAbandonedCartListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsOverview {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  kpis: {
    grossSales: number;
    netSales: number;
    totalOrders: number;
    averageOrderValue: number;
    cancellationRate: number;
    returnRate: number;
    approvedPaymentsAmount: number;
    approvalRate: number;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    unitsSold: number;
    revenue: number;
    shareOfNetSales: number;
  }>;
}

export interface AnalyticsFulfillmentSla {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  items: Array<{
    transition: string;
    sampleCount: number;
    avgMinutes: number;
    p50Minutes: number;
    p90Minutes: number;
  }>;
}

export interface AnalyticsPaymentsPerformance {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  kpis: {
    totalPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    pendingPayments: number;
    underReviewPayments: number;
    refundedPayments: number;
    approvalRate: number;
    approvedAmount: number;
    avgReviewMinutes: number;
    p50ReviewMinutes: number;
    p90ReviewMinutes: number;
  };
}

export interface AnalyticsPromotionsEfficiency {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  kpis: {
    grossSales: number;
    netSales: number;
    discountTotal: number;
    discountedOrders: number;
    couponOrders: number;
    discountRate: number;
    revenuePerDiscountUnit: number;
    averageDiscountPerDiscountedOrder: number;
  };
  topCoupons: Array<{
    couponCode: string;
    ordersCount: number;
    discountTotal: number;
    netSales: number;
  }>;
}

export interface AnalyticsInventoryHealth {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  kpis: {
    totalVariants: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    reservedUnits: number;
    variantsWithSales: number;
    sellThroughRate: number;
  };
  lowStockItems: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
    lowStockThreshold: number;
    unitsSold: number;
  }>;
  slowMovingItems: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
  }>;
}

export interface AnalyticsStockoutRisk {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  items: Array<{
    variantId: string;
    productId: string;
    productTitle: string;
    sku: string;
    availableQuantity: number;
    unitsSold: number;
    revenue: number;
    avgDailyUnits: number;
    daysOfCover: number;
  }>;
}

export interface AnalyticsCustomersRetention {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  kpis: {
    activeCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatCustomers: number;
    repeatPurchaseRate: number;
    averageOrdersPerCustomer: number;
  };
  topRepeatCustomers: Array<{
    customerId: string;
    fullName: string;
    phone: string;
    ordersInWindow: number;
    lifetimeOrders: number;
    netSalesInWindow: number;
  }>;
}

export interface AnalyticsFunnelConversion {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  stages: Array<{
    event: string;
    sessions: number;
    stepConversionRate: number;
    fromVisitRate: number;
  }>;
}

export interface AnalyticsSourceAttribution {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  items: Array<{
    source: string;
    medium: string;
    campaign: string;
    visits: number;
    checkoutStarts: number;
    checkouts: number;
    visitToCheckoutRate: number;
  }>;
}

export interface AnalyticsAffiliatePerformance {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  items: Array<{
    affiliateId: string;
    affiliateName: string;
    clicks: number;
    attributedOrders: number;
    conversionRate: number;
    approvedCommissions: number;
    paidCommissions: number;
    pendingCommissions: number;
  }>;
}

export interface AnalyticsAbandonedCartMetrics {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  kpis: {
    abandonedCartsCount: number;
    recoveryEmailsSent: number;
    recoveredCartsCount: number;
    recoveredRevenue: number;
    recoveryRate: number;
    abandonmentRate: number;
    averageRecoveryMinutes: number;
  };
}

export interface AnalyticsEventTaxonomy {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  items: Array<{
    eventName: string;
    baseEventType: string;
    totalEvents: number;
    uniqueSessions: number;
  }>;
}

export interface AnalyticsDataQuality {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  checks: Array<{
    key: string;
    value: number;
    severity: 'ok' | 'warning' | 'critical';
    description: string;
  }>;
}

export interface AnalyticsAnomalyReport {
  windowDays: number;
  timezone: string;
  thresholdPercent: number;
  currentWindow: { startAt: string; endAt: string };
  previousWindow: { startAt: string; endAt: string };
  alerts: Array<{
    key: 'net_sales' | 'total_orders' | 'approved_payments' | 'funnel_conversion';
    severity: 'warning' | 'critical';
    currentValue: number;
    previousValue: number;
    deltaPercent: number;
    message: string;
  }>;
}

export interface AnalyticsGeneral {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  summary: {
    totalSales: number;
    totalOrders: number;
    totalSessions: number;
    totalCustomers: number;
  };
  salesTrend: Array<{ day: string; sales: number; orders: number }>;
  customerJourneyFunnel: Array<{
    event: string;
    sessions: number;
    stepConversionRate: number;
    fromVisitRate: number;
  }>;
  trafficSources: {
    split: Array<{ sourceType: 'public' | 'affiliate'; visits: number; checkouts: number }>;
    detailed: Array<{
      source: string;
      medium: string;
      campaign: string;
      visits: number;
      checkoutStarts: number;
      checkouts: number;
      visitToCheckoutRate: number;
    }>;
  };
  paymentMethods: Array<{ key: string; count: number; amount: number }>;
  shippingMethods: Array<{ key: string; count: number; amount: number }>;
  topCustomersByOrders: AnalyticsCustomersRetention['topRepeatCustomers'];
  topCustomersBySales: AnalyticsCustomersRetention['topRepeatCustomers'];
  topCitiesByOrders: Array<{ city: string; orders: number; sales: number }>;
  topCitiesBySales: Array<{ city: string; orders: number; sales: number }>;
  topProductsByQuantity: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
  topProductsBySales: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
  orderStatusSummary: Array<{ status: string; count: number; percentage: number }>;
}

export interface AnalyticsLive {
  timezone: string;
  liveMinutes: number;
  startAt: string;
  endAt: string;
  liveVisits: number;
  topVisitedPages: Array<{ page: string; visits: number }>;
  liveOrders: number;
  liveSales: number;
  topCities: Array<{ city: string; orders: number; sales: number }>;
  topProducts: Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    grossSales: number;
  }>;
}

export interface AnalyticsProductsTable {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  items: Array<{
    productId: string;
    productTitle: string;
    totalSales: number;
    totalDiscounts: number;
    salesCount: number;
  }>;
}

export interface AnalyticsOperations {
  windowDays: number;
  timezone: string;
  startAt: string;
  endAt: string;
  kpis: {
    totalShipments: number;
    totalOrders: number;
    avgOrderPreparationMinutes: number;
    avgDeliveryMinutes: number;
    avgReturnMinutes: number;
  };
  paymentMethods: Array<{ key: string; count: number; amount: number }>;
  shippingMethods: Array<{ key: string; count: number; amount: number }>;
  orderStatusSummary: Array<{ status: string; count: number; percentage: number }>;
}

export interface AnalyticsPaymentsAdvanced {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  metrics: {
    successfulOperations: number;
    failedOperations: number;
    refundedOperations: number;
    pendingOperations: number;
    successRate: number;
    failureRate: number;
    refundRate: number;
    refundedSalesVolume: number;
    successfulSalesVolume: number;
    settledOperations: number;
    depositOperations: number;
    suspendedOperations: number;
    successfulCompletedOperations: number;
    collectedAmount: number;
  };
  methods: Array<{ key: string; count: number; amount: number }>;
}

export interface AnalyticsFinancial {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  totals: {
    grossSalesValue: number;
    ordersCount: number;
    productsSalesValue: number;
    shippingValue: number;
    discountValue: number;
  };
  platformPerformance: Array<{ sourceType: 'public' | 'affiliate'; sales: number; orders: number }>;
}

export interface AnalyticsShipments {
  windowDays: number;
  timezone: string;
  currencyCode: string;
  startAt: string;
  endAt: string;
  counts: {
    totalShipments: number;
    totalOrders: number;
    deliveryOrders: number;
    pickupOrders: number;
    delivered: number;
    inTransit: number;
    cancelled: number;
    failedDelivery: number;
    lost: number;
    damaged: number;
    delayed: number;
    lateReceived: number;
  };
  rates: {
    deliveredRate: number;
    failedRate: number;
    damagedRate: number;
    delayedRate: number;
  };
  fees: {
    totalShippingFees: number;
    averageShippingFee: number;
  };
  methods: Array<{ key: string; count: number; amount: number }>;
  topAreas: Array<{ area: string; orders: number }>;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<OrderStatus, number>;
}

export interface ManualOrderProduct {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  price: number;
  stockUnlimited: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface ManualOrderProductSearchResponse {
  items: ManualOrderProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface ShippingZone {
  id: string;
  storeId: string;
  name: string;
  city: string | null;
  area: string | null;
  description: string | null;
  fee: number;
  isActive: boolean;
  nameAr: string | null;
  nameEn: string | null;
  cityAr: string | null;
  cityEn: string | null;
  areaAr: string | null;
  areaEn: string | null;
}

export type ShippingMethodType =
  | 'flat_rate'
  | 'by_weight'
  | 'by_item'
  | 'weight_tier'
  | 'order_value_tier'
  | 'free_shipping'
  | 'store_pickup';

export interface ShippingMethodRange {
  min: number;
  max: number | null;
  cost: number;
  sortOrder: number;
}

export interface ShippingMethod {
  id: string;
  storeId: string;
  shippingZoneId: string;
  type: ShippingMethodType;
  displayName: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  config: Record<string, unknown>;
  ranges: ShippingMethodRange[];
}

export type DiscountType = 'percent' | 'fixed';
export type OfferTargetType = 'product' | 'category' | 'cart';

export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  isFreeShipping: boolean;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
}

export interface Offer {
  id: string;
  storeId: string;
  name: string;
  targetType: OfferTargetType;
  targetProductId: string | null;
  targetCategoryId: string | null;
  discountType: DiscountType;
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  nameAr: string | null;
  nameEn: string | null;
}

export type AdvancedOfferType = 'bxgy' | 'bundle' | 'tiered_discount';

export interface AdvancedOffer {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  offerType: AdvancedOfferType;
  config: Record<string, unknown>;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  priority: number;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
}

export interface AffiliateSettings {
  enabled: boolean;
  defaultRatePercent: number;
  attributionWindowDays: number;
  minPayoutAmount: number;
}

export interface AffiliateProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'inactive';
  commissionRatePercent: number;
  payoutMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateLink {
  id: string;
  affiliateId: string;
  code: string;
  targetPath: string;
  isActive: boolean;
  createdAt: string;
}

export interface AffiliateCommission {
  id: string;
  orderId: string;
  orderCode: string;
  affiliateId: string;
  affiliateName: string;
  status: 'pending' | 'approved' | 'reversed' | 'paid';
  commissionBase: number;
  commissionAmount: number;
  reversedAmount: number;
  netAmount: number;
  approvedAt: string | null;
  paidAt: string | null;
  reversedAt: string | null;
  createdAt: string;
}

export interface AffiliateCommissionsResponse {
  items: AffiliateCommission[];
  total: number;
  page: number;
  limit: number;
}

export interface AffiliatePayoutBatch {
  id: string;
  status: 'draft' | 'finalized' | 'paid';
  currencyCode: string;
  totalAmount: number;
  itemsCount: number;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ThemeState {
  storeId: string;
  version: number;
  draftConfig: Record<string, unknown>;
  publishedConfig: Record<string, unknown>;
  status?: 'published' | 'draft' | 'unpublished_changes' | 'not_configured';
  templateKey?: string | null;
  templateName?: string | null;
  draftVersion?: number;
  publishedVersion?: number;
  hasUnpublishedChanges?: boolean;
  lastPublishedAt?: string | null;
}

export type ThemeTemplateCategory =
  | 'fashion'
  | 'electronics'
  | 'beauty'
  | 'grocery'
  | 'luxury'
  | 'minimal'
  | 'restaurant'
  | 'general';

export interface ThemeTemplate {
  id: string;
  templateKey: string;
  name: string;
  description: string;
  category: ThemeTemplateCategory;
  rendererType: 'component';
  componentKey: string;
  previewImageUrl: string | null;
  thumbnailUrl: string | null;
  previewImages: string[];
  isPremium: boolean;
  allowedPlans: string[];
  version: number;
  capabilities: Record<string, unknown>;
  settingsSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  suitableFor?: string;
  requiredPlan?: string;
  tags?: string[];
  sectionCount?: number;
  palette?: {
    primary: string;
    accent: string;
    background: string;
  };
  config?: Record<string, unknown>;
}

export interface ThemeTemplateListResponse {
  items: ThemeTemplate[];
}

export interface ThemeVersion {
  id: string;
  storeId: string;
  themeId: string;
  version: number;
  publishedBy: string | null;
  publishedAt: string;
  changeSummary: Record<string, unknown>;
}

export interface ThemeVersionListResponse {
  items: ThemeVersion[];
}

export interface PreviewTokenResponse {
  previewToken: string;
  expiresAt: string;
}

export type DomainStatus = 'pending' | 'verified' | 'active';
export type DomainSslStatus = 'pending' | 'requested' | 'issued' | 'error';

export interface Domain {
  id: string;
  storeId: string;
  hostname: string;
  routingType?: 'cname';
  routingHost?: string;
  routingTarget?: string;
  status: DomainStatus;
  sslStatus: DomainSslStatus;
  sslProvider?: 'manual' | 'cloudflare';
  sslMode?: 'full' | 'full_strict';
  sslLastCheckedAt?: string | null;
  sslError?: string | null;
  verificationToken: string;
  verificationDnsHost: string;
  verifiedAt: string | null;
  activatedAt: string | null;
  records?: DomainDnsRecord[];
  lastDnsCheckAt?: string | null;
  supportRequired?: boolean;
  merchantStatus?:
    | 'pending_dns'
    | 'verified'
    | 'issuing_ssl'
    | 'active'
    | 'dns_error'
    | 'support_required';
  rootDomainWarning?: string | null;
}

export interface DomainDnsRecord {
  type: 'CNAME' | 'TXT';
  name: string;
  value: string;
  purpose: 'routing' | 'ownership' | 'ssl' | 'cloudflare_ownership';
  required: boolean;
  status: 'valid' | 'missing' | 'wrong_value' | 'error' | 'pending';
}

export interface CompleteDomainSetupResponse extends Domain {
  setupComplete: boolean;
  message: string;
}

export interface UserProfile {
  id: string;
  storeId: string;
  email: string;
  fullName: string;
  role: StoreRole;
  permissions: string[];
  isActive?: boolean;
}

export interface StaffInvite {
  id: string;
  email: string;
  fullName: string;
  role: StoreRole;
  expiresAt: string;
  inviteToken?: string;
}

export interface InviteValidation {
  valid: boolean;
  email: string;
  fullName: string;
  storeName?: string;
}

export interface AttributeValue {
  id: string;
  storeId: string;
  attributeId: string;
  value: string;
  slug: string;
  valueAr: string | null;
  valueEn: string | null;
  colorHex: string | null;
  isActive: boolean;
}

export type AttributeType = 'dropdown' | 'color';

export interface Attribute {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  values?: AttributeValue[];
  nameAr: string | null;
  nameEn: string | null;
  type: AttributeType;
  descriptionAr: string | null;
  descriptionEn: string | null;
  isActive: boolean;
}

export interface CategoryAttributes {
  categoryId: string;
  attributeIds: string[];
}

export type FilterType = 'checkbox' | 'radio' | 'color' | 'range';

export type FilterSourceType = 'manual' | 'brand' | 'attribute' | 'price' | 'warehouse' | 'availability';

export interface FilterValue {
  id: string;
  storeId: string;
  filterId: string;
  valueAr: string;
  valueEn: string;
  slug: string;
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Filter {
  id: string;
  storeId: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  type: FilterType;
  sortOrder: number;
  isActive: boolean;
  sourceType: FilterSourceType;
  sourceAttributeId: string | null;
  sourceKey: string | null;
  displayType: string | null;
  isSystem: boolean;
  values?: FilterValue[];
}

export interface Attribute {
  id: string;
  storeId: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  slug: string;
  type: 'dropdown' | 'color';
  isActive: boolean;
  values?: AttributeValue[];
}

export interface AttributeValue {
  id: string;
  attributeId: string;
  value: string;
  valueAr: string | null;
  valueEn: string | null;
  slug: string;
  colorHex: string | null;
  isActive: boolean;
}

export interface ProductFilterSelection {
  productId: string;
  valueIds: string[];
  ranges: Array<{ filterId: string; filterSlug: string; numericValue: number }>;
}

export interface WebhookEndpoint {
  id: string;
  storeId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  storeId: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attemptNumber: number;
  deliveredAt: string | null;
  nextRetryAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface LoyaltySettings {
  isEnabled: boolean;
  redeemRatePoints: number;
  redeemRateAmount: number;
  minRedeemPoints: number;
  redeemStepPoints: number;
  maxDiscountPercent: number;
}

export interface LoyaltyRule {
  id: string;
  name: string;
  ruleType: 'order_percent';
  earnRate: number;
  minOrderAmount: number;
  isActive: boolean;
  priority: number;
}

export interface LoyaltyWallet {
  customerId: string;
  availablePoints: number;
  lockedPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
}

export interface LoyaltyLedgerEntry {
  id: string;
  customerId: string;
  orderId: string | null;
  entryType: 'earn' | 'redeem' | 'adjust' | 'reverse';
  pointsDelta: number;
  amountDelta: number;
  balanceAfter: number;
  referenceEntryId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdByStoreUserId: string | null;
  createdAt: string;
}

export type SubscriptionBillingCycle = 'monthly' | 'annual' | 'manual';

export interface PlanLimitView {
  metricKey: string;
  metricLimit: number | null;
  resetPeriod: 'monthly' | 'lifetime';
}

export interface PlanEntitlementView {
  featureKey: string;
  isEnabled: boolean;
}

export interface BillingPlanView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyCompareAtPrice: number | null;
  annualCompareAtPrice: number | null;
  currencyCode: string;
  billingCycleOptions: string[];
  trialDaysDefault: number;
  saleLabel: string | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isIntroOffer: boolean;
  isSaleActive: boolean;
  isSaleVisible: boolean;
  limits: PlanLimitView[];
  entitlements: PlanEntitlementView[];
}

export interface StoreSubscriptionView {
  id: string;
  storeId: string;
  status: string;
  startsAt: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  billingCycle: SubscriptionBillingCycle;
  nextBillingAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    monthlyPrice: number | null;
    annualPrice: number | null;
    monthlyCompareAtPrice: number | null;
    annualCompareAtPrice: number | null;
    currencyCode: string;
    saleLabel: string | null;
    saleStartsAt: string | null;
    saleEndsAt: string | null;
    isIntroOffer: boolean;
    isSaleActive: boolean;
    isSaleVisible: boolean;
  };
  limits: PlanLimitView[];
  entitlements: PlanEntitlementView[];
  usage: Array<{
    metricKey: string;
    used: number;
    limit: number | null;
    resetPeriod: 'monthly' | 'lifetime';
  }>;
}

export interface SubscriptionInvoiceView {
  id: string;
  invoiceNumber: string;
  billingCycle: 'monthly' | 'annual' | 'proration' | 'manual';
  subtotalAmount: number;
  originalAmount: number | null;
  discountAmount: number;
  couponCode: string | null;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: 'draft' | 'open' | 'paid' | 'failed' | 'void';
  dueAt: string | null;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface BillingInvoicesPage {
  items: SubscriptionInvoiceView[];
  total: number;
  page: number;
  limit: number;
}

export interface SubscriptionReceiptView {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'canceled';
  amount: number;
  currencyCode: string;
  transactionReference: string | null;
  receiptMediaId: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptSizeBytes: number | null;
  merchantNote: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface BillingReceiptsPage {
  items: SubscriptionReceiptView[];
  total: number;
  page: number;
  limit: number;
}

export type SupportTicketScope = 'b2b' | 'b2c';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketStatus =
  | 'open'
  | 'waiting_customer'
  | 'waiting_agent'
  | 'resolved'
  | 'closed';

export interface SupportTicketSummary {
  id: string;
  storeId: string;
  scope: SupportTicketScope;
  source: string;
  subject: string;
  description: string | null;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  requester: {
    type: string;
    customerId: string | null;
    storeUserId: string | null;
    label: string | null;
    name: string | null;
  };
  assignee: {
    type: 'store_user' | 'platform_agent' | null;
    storeUserId: string | null;
    label: string | null;
    name: string | null;
  };
  sla: {
    firstResponseDueAt: string | null;
    resolveDueAt: string | null;
    firstResponseAt: string | null;
  };
  resolvedAt: string | null;
  closedAt: string | null;
  lastMessageAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  storeId: string;
  authorType: string;
  authorCustomerId: string | null;
  authorStoreUserId: string | null;
  authorName: string | null;
  authorLabel: string | null;
  message: string;
  isInternal: boolean;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketEvent {
  id: string;
  ticketId: string;
  storeId: string;
  eventType: string;
  actorType: string;
  actorCustomerId: string | null;
  actorStoreUserId: string | null;
  actorName: string | null;
  actorLabel: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SupportTicketsListResponse {
  items: SupportTicketSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface SupportTicketDetailResponse {
  ticket: SupportTicketSummary;
  messages: SupportTicketMessage[];
  events: SupportTicketEvent[];
}

export type NotificationStatus = 'unread' | 'read';
export type NotificationCategory =
  | 'orders'
  | 'payments'
  | 'inventory'
  | 'cart'
  | 'checkout'
  | 'support'
  | 'domain'
  | 'theme'
  | 'analytics'
  | 'system';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface NotificationInboxItem {
  id: string;
  storeId: string | null;
  recipientType: 'store' | 'store_user' | 'customer' | 'platform';
  recipientStoreUserId: string | null;
  recipientCustomerId: string | null;
  recipientLabel: string | null;
  type: string;
  category: NotificationCategory | null;
  severity: NotificationSeverity;
  source: string;
  dedupeKey: string | null;
  expiresAt: string | null;
  title: string;
  body: string;
  status: NotificationStatus;
  readAt: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsInboxResponse {
  items: NotificationInboxItem[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationPreference {
  id: string;
  storeId: string | null;
  recipientType: 'store' | 'store_user' | 'customer';
  recipientStoreUserId: string | null;
  recipientCustomerId: string | null;
  eventType: string;
  category?: NotificationCategory | null;
  severity?: NotificationSeverity;
  channel: 'inbox' | 'email';
  isEnabled: boolean;
  frequency: 'instant' | 'daily_digest' | 'mute';
  createdAt: string;
  updatedAt: string;
}
