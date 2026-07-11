import type { ReactElement } from 'react';
import type { MerchantRequestOptions } from './api-client';
import type { MerchantSession, StoreSettings } from './types';

export type MerchantTabKey =
  | 'overview'
  | 'setup'
  | 'analyticsGeneral'
  | 'analyticsLive'
  | 'analyticsProducts'
  | 'analyticsOperations'
  | 'analyticsPayments'
  | 'analyticsFinancial'
  | 'analyticsShipments'
  | 'reportsCustomers'
  | 'reportsSales'
  | 'reportsInventory'
  | 'store'
  | 'storePages'
  | 'products'
  | 'inventory'
  | 'warehouses'
  | 'attributes'
  | 'filters'
  | 'categories'
  | 'brands'
  | 'customers'
  | 'customerReviews'
  | 'customerQuestions'
  | 'supportTickets'
  | 'notificationsCenter'
  | 'abandonedCarts'
  | 'restockAlerts'
  | 'orders'
  | 'payments'
  | 'shipping'
  | 'promotions'
  | 'advancedPromotions'
  | 'coupons'
  | 'affiliates'
  | 'loyalty'
  | 'staff'
  | 'webhooks';

export type MerchantRequester = <T>(
  path: string,
  init?: RequestInit,
  options?: MerchantRequestOptions,
) => Promise<T | null>;

export interface MerchantPanelProps {
  session: MerchantSession;
  request: MerchantRequester;
  storeSettings?: StoreSettings | null;
  onStoreSettingsUpdated?: (settings: StoreSettings) => void;
  notificationRealtimeVersion?: number;
  onNavigate?: (tab: MerchantTabKey) => void;
}

export interface MerchantNavItem {
  key: MerchantTabKey | string;
  label: string;
  icon?: ReactElement;
  children?: { key: MerchantTabKey; label: string; icon?: ReactElement }[];
}
