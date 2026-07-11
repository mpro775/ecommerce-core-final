const DEFAULT_LOCALE = 'en-US';

declare global {
  interface Window {
    __kaleemLatinDigitsPatched__?: boolean;
  }
}

function withLatinNumberingSystem(localeTag: string): string {
  const trimmed = localeTag.trim();
  const baseLocale = trimmed.length > 0 ? trimmed : DEFAULT_LOCALE;

  if (!baseLocale.includes('-u-')) {
    return `${baseLocale}-u-nu-latn`;
  }

  if (/-nu-[a-z0-9]+/i.test(baseLocale)) {
    return baseLocale.replace(/-nu-[a-z0-9]+/i, '-nu-latn');
  }

  return `${baseLocale}-nu-latn`;
}

function normalizeLocales(locales?: Intl.LocalesArgument): Intl.LocalesArgument {
  if (!locales) {
    const browserLocale =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : DEFAULT_LOCALE;
    return withLatinNumberingSystem(browserLocale);
  }

  if (Array.isArray(locales)) {
    return locales.map((locale) => withLatinNumberingSystem(String(locale)));
  }

  return withLatinNumberingSystem(String(locales));
}

export function enforceLatinDigitsInLocaleFormatting(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.__kaleemLatinDigitsPatched__) {
    return;
  }

  const originalNumberToLocaleString = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function patchedNumberToLocaleString(
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions,
  ): string {
    return originalNumberToLocaleString.call(this, normalizeLocales(locales), options);
  };

  const originalDateToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function patchedDateToLocaleString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    return originalDateToLocaleString.call(this, normalizeLocales(locales), options);
  };

  const originalDateToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function patchedDateToLocaleDateString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    return originalDateToLocaleDateString.call(this, normalizeLocales(locales), options);
  };

  const originalDateToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function patchedDateToLocaleTimeString(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    return originalDateToLocaleTimeString.call(this, normalizeLocales(locales), options);
  };

  window.__kaleemLatinDigitsPatched__ = true;
}
