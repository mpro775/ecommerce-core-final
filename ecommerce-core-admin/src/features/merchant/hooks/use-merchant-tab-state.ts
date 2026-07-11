import { useCallback, useEffect, useState } from 'react';
import { isMerchantTabKey } from '../constants/merchant-navigation';
import type { MerchantTabKey } from '../merchant-dashboard.types';

interface SetMerchantTabOptions {
  replace?: boolean;
}

type SetMerchantTab = (nextTab: MerchantTabKey, options?: SetMerchantTabOptions) => void;

const TAB_QUERY_PARAM = 'tab';

function readTabFromLocation(defaultTab: MerchantTabKey): MerchantTabKey {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get(TAB_QUERY_PARAM);
  if (!tab || !isMerchantTabKey(tab)) {
    return defaultTab;
  }
  return tab;
}

function writeTabToLocation(tab: MerchantTabKey, replace = false): void {
  const url = new URL(window.location.href);
  url.searchParams.set(TAB_QUERY_PARAM, tab);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (replace) {
    window.history.replaceState({}, '', nextUrl);
    return;
  }
  window.history.pushState({}, '', nextUrl);
}

export function useMerchantTabState(defaultTab: MerchantTabKey): [MerchantTabKey, SetMerchantTab] {
  const [activeTab, setActiveTabState] = useState<MerchantTabKey>(() => readTabFromLocation(defaultTab));

  useEffect(() => {
    const currentTab = readTabFromLocation(defaultTab);
    setActiveTabState(currentTab);

    const params = new URLSearchParams(window.location.search);
    const rawTab = params.get(TAB_QUERY_PARAM);
    if (rawTab !== currentTab) {
      writeTabToLocation(currentTab, true);
    }

    const handlePopState = () => {
      setActiveTabState(readTabFromLocation(defaultTab));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [defaultTab]);

  const setActiveTab = useCallback<SetMerchantTab>((nextTab, options) => {
    setActiveTabState(nextTab);
    writeTabToLocation(nextTab, options?.replace ?? false);
  }, []);

  return [activeTab, setActiveTab];
}
