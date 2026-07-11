import type { ReactElement } from 'react';
import { AttributesPanel } from './panels/attributes-panel';
import { FiltersPanel } from './panels/filters-panel';
import { CategoriesPanel } from './panels/categories-panel';
import { BrandsPanel } from './panels/brands-panel';
import { CustomerQuestionsPanel } from './panels/customer-questions-panel';
import { CustomerReviewsPanel } from './panels/customer-reviews-panel';
import { CustomersPanel } from './panels/customers-panel';
import { NotificationsCenterPanel } from './panels/notifications-center-panel';
import { AbandonedCartsPanel } from './panels/abandoned-carts-panel';
import { InventoryPanel } from './panels/inventory-panel';
import { OrdersPanel } from './panels/orders-panel';
import { PaymentsPanel } from './panels/payments-panel';
import { ProductsPanel } from './panels/products-panel';
import { PromotionsPanel } from './panels/promotions-panel';
import { CouponsPanel } from './panels/coupons-panel';
import { AdvancedPromotionsPanel } from './panels/advanced-promotions-panel';
import { AffiliatesPanel } from './panels/affiliates-panel';
import { LoyaltyPanel } from './panels/loyalty-panel';
import { RestockAlertsPanel } from './panels/restock-alerts-panel';
import { ShippingPanel } from './panels/shipping-panel';
import { StaffPanel } from './panels/staff-panel';
import { StoreSettingsPanel } from './panels/store-settings-panel';
import { StorePagesPanel } from './panels/store-pages-panel';
import { SetupPanel } from './panels/setup-panel';
import { SupportTicketsPanel } from './panels/support-tickets-panel';
import { WebhooksPanel } from './panels/webhooks-panel';
import { WarehousesPanel } from './panels/warehouses-panel';
import { OverviewPanel } from './overview/overview-panel';
import { AnalyticsGeneralPanel } from './panels/analytics-general-panel';
import { AnalyticsLivePanel } from './panels/analytics-live-panel';
import { AnalyticsProductsPanel } from './panels/analytics-products-panel';
import { AnalyticsOperationsPanel } from './panels/analytics-operations-panel';
import { AnalyticsPaymentsPanel } from './panels/analytics-payments-panel';
import { AnalyticsFinancialPanel } from './panels/analytics-financial-panel';
import { AnalyticsShipmentsPanel } from './panels/analytics-shipments-panel';
import { ReportsCustomersPanel } from './panels/reports-customers-panel';
import { ReportsSalesPanel } from './panels/reports-sales-panel';
import { ReportsInventoryPanel } from './panels/reports-inventory-panel';
import type { MerchantPanelProps, MerchantTabKey } from './merchant-dashboard.types';

const panelRenderers: Record<MerchantTabKey, (props: MerchantPanelProps) => ReactElement> = {
  overview: (props) => (
    <OverviewPanel
      session={props.session}
      request={props.request}
      storeSettings={props.storeSettings ?? null}
      onOpenSetup={() => props.onNavigate?.('setup')}
    />
  ),
  setup: (props) => <SetupPanel request={props.request} onNavigate={(tab) => props.onNavigate?.(tab)} />,
  analyticsGeneral: (props) => <AnalyticsGeneralPanel request={props.request} />,
  analyticsLive: (props) => <AnalyticsLivePanel request={props.request} />,
  analyticsProducts: (props) => <AnalyticsProductsPanel request={props.request} />,
  analyticsOperations: (props) => <AnalyticsOperationsPanel request={props.request} />,
  analyticsPayments: (props) => <AnalyticsPaymentsPanel request={props.request} />,
  analyticsFinancial: (props) => <AnalyticsFinancialPanel request={props.request} />,
  analyticsShipments: (props) => <AnalyticsShipmentsPanel request={props.request} />,
  reportsCustomers: (props) => <ReportsCustomersPanel request={props.request} />,
  reportsSales: (props) => <ReportsSalesPanel request={props.request} />,
  reportsInventory: (props) => <ReportsInventoryPanel request={props.request} />,
  store: (props) => (
    <StoreSettingsPanel
      request={props.request}
      {...(props.onStoreSettingsUpdated ? { onSettingsUpdated: props.onStoreSettingsUpdated } : {})}
    />
  ),
  storePages: (props) => <StorePagesPanel request={props.request} />,
  products: (props) => <ProductsPanel request={props.request} />,
  inventory: (props) => <InventoryPanel request={props.request} />,
  warehouses: (props) => <WarehousesPanel request={props.request} />,
  attributes: (props) => <AttributesPanel request={props.request} />,
  filters: (props) => <FiltersPanel request={props.request} />,
  categories: (props) => <CategoriesPanel request={props.request} />,
  brands: (props) => <BrandsPanel request={props.request} />,
  customers: (props) => <CustomersPanel request={props.request} />,
  abandonedCarts: (props) => <AbandonedCartsPanel request={props.request} />,
  customerReviews: (props) => <CustomerReviewsPanel request={props.request} />,
  customerQuestions: (props) => <CustomerQuestionsPanel request={props.request} />,
  supportTickets: (props) => <SupportTicketsPanel request={props.request} />,
  notificationsCenter: (props) => (
    <NotificationsCenterPanel
      request={props.request}
      notificationRealtimeVersion={props.notificationRealtimeVersion ?? 0}
    />
  ),
  restockAlerts: (props) => <RestockAlertsPanel request={props.request} />,
  orders: (props) => <OrdersPanel request={props.request} />,
  payments: (props) => <PaymentsPanel request={props.request} />,
  shipping: (props) => <ShippingPanel request={props.request} />,
  promotions: (props) => <PromotionsPanel request={props.request} />,
  advancedPromotions: (props) => <AdvancedPromotionsPanel request={props.request} />,
  coupons: (props) => <CouponsPanel request={props.request} />,
  affiliates: (props) => <AffiliatesPanel request={props.request} />,
  loyalty: (props) => <LoyaltyPanel request={props.request} />,
  webhooks: (props) => <WebhooksPanel request={props.request} />,
  staff: (props) => <StaffPanel request={props.request} />,
};

export function renderMerchantPanel(activeTab: MerchantTabKey, props: MerchantPanelProps): ReactElement | null {
  const renderer = panelRenderers[activeTab];
  return renderer ? renderer(props) : null;
}
