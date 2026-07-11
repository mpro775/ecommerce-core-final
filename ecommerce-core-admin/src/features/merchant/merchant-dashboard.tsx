import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Alert, Snackbar, useMediaQuery, useTheme } from '@mui/material';
import {
  clearMerchantSessionCache,
  merchantRequestJson,
  type MerchantRequestOptions,
} from './api-client';
import {
  MERCHANT_DRAWER_WIDTH,
  MERCHANT_NAV_ITEMS,
  MERCHANT_PRIMARY_MOBILE_TABS,
} from './constants/merchant-navigation';
import { MerchantDashboardLayout } from './components/layout/merchant-dashboard-layout';
import { MerchantMobileNav } from './components/navigation/merchant-mobile-nav';
import { MerchantSidebar } from './components/navigation/merchant-sidebar';
import { MerchantTopBar } from './components/navigation/merchant-top-bar';
import { useMerchantTabState } from './hooks/use-merchant-tab-state';
import { useMerchantNotificationsRealtime } from './hooks/use-merchant-notifications-realtime';
import { useNotificationSound } from './hooks/use-notification-sound';
import { renderMerchantPanel } from './panel-registry';
import { buildStorefrontVisitUrl } from './storefront-url';
import type {
  MerchantRequester,
  MerchantTabKey,
  MerchantNavItem,
} from './merchant-dashboard.types';
import type { MerchantSession, StoreSettings } from './types';

export type {
  MerchantNavItem,
  MerchantPanelProps,
  MerchantRequester,
  MerchantTabKey,
} from './merchant-dashboard.types';

interface MerchantDashboardProps {
  session: MerchantSession;
  onSessionUpdate: (session: MerchantSession) => void;
  themeMode: 'light' | 'dark';
  onToggleThemeMode: (origin?: { x: number; y: number }) => void;
  onSignedOut: () => void;
}

export function MerchantDashboard({
  session,
  onSessionUpdate,
  themeMode,
  onToggleThemeMode,
  onSignedOut,
}: MerchantDashboardProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeTab, setActiveTab] = useMerchantTabState('overview');
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const { play: playNotificationSound } = useNotificationSound();

  const request = useCallback<MerchantRequester>(
    async <T,>(path: string, init?: RequestInit, options?: MerchantRequestOptions) =>
      merchantRequestJson<T>({
        session,
        path,
        init,
        options,
        onSessionUpdate,
        onSessionExpired: onSignedOut,
      }),
    [onSessionUpdate, onSignedOut, session],
  );

  const handleNotificationCreated = useCallback(
    (payload: unknown) => {
      playNotificationSound();
      const data = payload as Record<string, unknown> | null | undefined;
      const title = (data?.title as string) || 'وصل إشعار جديد';
      setToastMessage(title);
      setToastOpen(true);
    },
    [playNotificationSound],
  );

  const { unreadCount: notificationUnreadCount, notificationRealtimeVersion } =
    useMerchantNotificationsRealtime(session, request, handleNotificationCreated);

  useEffect(() => {
    if (isDesktop) {
      setMobileSidebarOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoreSettings(): Promise<void> {
      try {
        const settings = await request<StoreSettings>('/store/settings');
        if (!cancelled) {
          setStoreSettings(settings ?? null);
        }
      } catch {
        if (!cancelled) {
          setStoreSettings(null);
        }
      }
    }

    loadStoreSettings().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [request]);

  const activeLabel = useMemo(() => {
    for (const group of MERCHANT_NAV_ITEMS) {
      if (group.children) {
        const found = group.children.find((child) => child.key === activeTab);
        if (found) return found.label;
      } else if (group.key === activeTab) {
        return group.label;
      }
    }
    return 'لوحة التحكم';
  }, [activeTab]);

  const primaryMobileItems = useMemo<MerchantNavItem[]>(() => {
    const allItems: MerchantNavItem[] = [];
    MERCHANT_NAV_ITEMS.forEach((group) => {
      if (group.children) {
        allItems.push(...(group.children as MerchantNavItem[]));
      } else {
        allItems.push(group as MerchantNavItem);
      }
    });
    return allItems.filter((item) =>
      MERCHANT_PRIMARY_MOBILE_TABS.includes(item.key as MerchantTabKey),
    );
  }, []);

  const storefrontVisitUrl = useMemo(
    () => buildStorefrontVisitUrl(session.apiBaseUrl, storeSettings?.slug ?? null),
    [session.apiBaseUrl, storeSettings?.slug],
  );

  const handleOpenNavigation = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleCloseNavigation = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const handleSelectTab = useCallback(
    (nextTab: MerchantTabKey) => {
      setActiveTab(nextTab);
      setBannerMessage('');
      if (!isDesktop) {
        setMobileSidebarOpen(false);
      }
    },
    [isDesktop, setActiveTab],
  );

  const handleOpenUserMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  }, []);

  const handleCloseUserMenu = useCallback(() => {
    setUserMenuAnchorEl(null);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await request('/auth/logout', { method: 'POST' }, { includeStoreHeader: false });
    } catch {
      // Ignore sign-out network failures and clear session locally.
    }
    clearMerchantSessionCache();
    onSignedOut();
  }, [onSignedOut, request]);

  const handleSignOut = useCallback(() => {
    handleCloseUserMenu();
    signOut().catch(() => undefined);
  }, [handleCloseUserMenu, signOut]);

  return (
    <>
      <MerchantDashboardLayout
        bannerMessage={bannerMessage}
        sidebar={
        <MerchantSidebar
          drawerWidth={MERCHANT_DRAWER_WIDTH}
          navItems={MERCHANT_NAV_ITEMS}
          activeTab={activeTab}
          isDesktop={isDesktop}
          mobileOpen={mobileSidebarOpen}
          storeName={storeSettings?.name ?? null}
          storeLogoUrl={storeSettings?.logoUrl ?? null}
          onCloseMobile={handleCloseNavigation}
          onSelectTab={handleSelectTab}
        />
      }
      topBar={
        <MerchantTopBar
          activeLabel={activeLabel}
          session={session}
          storefrontVisitUrl={storefrontVisitUrl}
          storeName={storeSettings?.name ?? null}
          storeLogoUrl={storeSettings?.logoUrl ?? null}
          themeMode={themeMode}
          showNavigationToggle={!isDesktop}
          userMenuAnchorEl={userMenuAnchorEl}
          onToggleThemeMode={onToggleThemeMode}
          onOpenNavigation={handleOpenNavigation}
          onOpenUserMenu={handleOpenUserMenu}
          onCloseUserMenu={handleCloseUserMenu}
          onGoToStoreSettings={() => {
            handleCloseUserMenu();
            handleSelectTab('store');
          }}
          onGoToStaff={() => {
            handleCloseUserMenu();
            handleSelectTab('staff');
          }}
          notificationUnreadCount={notificationUnreadCount}
          onOpenNotifications={() => handleSelectTab('notificationsCenter')}
          request={request}
          notificationRealtimeVersion={notificationRealtimeVersion}
          onSignOut={handleSignOut}
        />
      }
      mobileNavigation={
        <MerchantMobileNav
          primaryItems={primaryMobileItems}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onOpenMore={handleOpenNavigation}
        />
      }
    >
      {renderMerchantPanel(activeTab, {
        session,
        request,
        storeSettings,
        onStoreSettingsUpdated: setStoreSettings,
        notificationRealtimeVersion,
        onNavigate: handleSelectTab,
      })}
    </MerchantDashboardLayout>

    <Snackbar
      open={toastOpen}
      autoHideDuration={4000}
      onClose={() => setToastOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="info" variant="filled" onClose={() => setToastOpen(false)}>
        {toastMessage}
      </Alert>
    </Snackbar>
    </>
  );
}
