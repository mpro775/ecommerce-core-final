import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbidden = [
  /\bstorePages\b|\bStorePages?\w*\b|\bstore_pages\b/,
  /\bThemeTemplate\w*\b|\bThemeVersion\w*\b|\bThemesModule\b|\bDomainsModule\b/,
  /\bstore_themes\b|\bstore_domains\b|\bcustom_domain\b|\bsubdomain\b/,
  /\b(?:logoMediaAssetId|faviconMediaAssetId|faviconUrl|businessCategory)\b/,
  /\b(?:shippingPolicy|returnPolicy|privacyPolicy|termsAndConditions|loyaltyPolicy)\b/,
  /\benabledFeatures\b|\bprofile_settings\b/,
  /VITE_SF_VISUAL_BUILDER_ENABLED|VITE_STOREFRONT_URL_PATTERN|buildDefaultStoreUrl/,
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : extensions.has(extname(entry.name)) ? [path] : [];
  });
}
const violations = [];
for (const file of walk(join(root, 'src'))) {
  readFileSync(file, 'utf8').split(/\r?\n/u).forEach((line, index) => {
    forbidden.forEach((pattern) => {
      if (pattern.test(line)) violations.push(`${relative(root, file)}:${index + 1}: ${pattern.source}`);
    });
  });
}
if (violations.length) {
  console.error('Legacy storefront-builder guard failed:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Legacy storefront-builder guard passed.');

