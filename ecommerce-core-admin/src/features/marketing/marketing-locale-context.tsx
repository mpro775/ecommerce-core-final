import { createContext, useContext, type ReactNode } from 'react';
import {
  marketingContent,
  type MarketingContent,
  type MarketingDirection,
  type MarketingLocale,
} from './marketing-content';

interface MarketingLocaleContextValue {
  content: MarketingContent;
  direction: MarketingDirection;
  isArabic: boolean;
  locale: MarketingLocale;
}

const MarketingLocaleContext = createContext<MarketingLocaleContextValue | null>(null);

interface MarketingLocaleProviderProps {
  children: ReactNode;
  locale: MarketingLocale;
}

export function MarketingLocaleProvider({ children, locale }: MarketingLocaleProviderProps) {
  const content = marketingContent[locale];
  const direction = content.direction as MarketingDirection;

  return (
    <MarketingLocaleContext.Provider
      value={{
        content,
        direction,
        isArabic: locale === 'ar',
        locale,
      }}
    >
      {children}
    </MarketingLocaleContext.Provider>
  );
}

export function useMarketingLocale() {
  const context = useContext(MarketingLocaleContext);

  if (!context) {
    throw new Error('useMarketingLocale must be used inside MarketingLocaleProvider');
  }

  return context;
}
