import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicPages = ['/', '/login', '/register'];
const merchantTabs = [
  { name: 'products', label: /المنتجات|Products/i },
  { name: 'orders', label: /الطلبات|Orders/i },
  { name: 'themes', label: /التصميم|القوالب|Themes|Templates/i },
  { name: 'store', label: /إعدادات المتجر|Store settings/i },
];

const testSession = {
  apiBaseUrl: 'http://localhost:3000',
  accessToken: 'a11y-access-token',
  refreshToken: 'a11y-refresh-token',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    storeId: '00000000-0000-0000-0000-000000000010',
    email: 'merchant-a11y@example.com',
    fullName: 'Merchant A11y',
    role: 'owner',
    permissions: ['*'],
    sessionId: 'a11y-session',
    onboardingCompleted: true,
  },
};

async function installMerchantSession(page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('merchant.session.v1', JSON.stringify(session));
    window.localStorage.setItem('merchant.apiBaseUrl.v1', session.apiBaseUrl);
  }, testSession);

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/store/settings', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: testSession.user.storeId,
        name: 'A11y Test Store',
        slug: 'a11y-test-store',
        logoMediaAssetId: null,
        logoUrl: null,
        faviconMediaAssetId: null,
        faviconUrl: null,
        businessCategory: null,
        onboardingCompleted: true,
        phone: null,
        address: null,
        country: 'SA',
        city: null,
        addressDetails: null,
        latitude: null,
        longitude: null,
        workingHours: [],
        socialLinks: {},
        currencyCode: 'SAR',
        timezone: 'Asia/Riyadh',
        shippingPolicy: null,
        returnPolicy: null,
        privacyPolicy: null,
        termsAndConditions: null,
        loyaltyPolicy: null,
      }),
    }),
  );
  await page.route('**/me/accessibility-preferences', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        highContrast: false,
        reducedMotion: false,
        fontScale: '100',
        underlineLinks: false,
        strongFocusRing: true,
      }),
    }),
  );
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(testSession.apiBaseUrl)) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
    }
    return route.continue();
  });
}

async function expectNoBlockingAxeViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);
}

for (const pagePath of publicPages) {
  test(`merchant admin ${pagePath} has no critical or serious accessibility violations`, async ({ page }) => {
    await page.goto(pagePath);
    await expectNoBlockingAxeViolations(page);
  });
}

test.describe('merchant authenticated workspace accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await installMerchantSession(page);
  });

  test('merchant shell and primary tabs have no critical or serious accessibility violations', async ({ page }) => {
    await page.goto('/merchant');
    await expectNoBlockingAxeViolations(page);

    for (const tab of merchantTabs) {
      await page.getByRole('button', { name: tab.label }).first().click();
      await expectNoBlockingAxeViolations(page);
    }
  });

  test('keyboard opens and closes drawer, user menu, and accessibility dialog', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/merchant');

    const menuButton = page.getByRole('button', { name: /فتح التنقل|فتح القائمة/i }).first();
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('presentation').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();

    const userMenuButton = page.getByRole('button', { name: /قائمة|Merchant A11y|مستخدم/i }).first();
    await userMenuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(userMenuButton).toBeFocused();

    const a11yButton = page.getByRole('button', { name: /إعدادات الوصول/i });
    await a11yButton.focus();
    await page.keyboard.press('Space');
    const dialog = page.getByRole('dialog', { name: /إعدادات الوصول/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(dialog).toContainText(/تباين|حجم الخط/i);
    await page.keyboard.press('Escape');
    await expect(a11yButton).toBeFocused();
  });
});
