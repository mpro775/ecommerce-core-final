import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['src'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const forbidden = [
  /\bStoreCapabilities(?:Module|Service)\b/,
  /\bStoreReadiness(?:Module|Service|Controller|Repository)?\b/,
  /merchant\/store-readiness/i,
  /\bonboardingCompleted\b/,
  /\bplatformPaymentMethodId\b/,
  /\bPlatformPaymentMethod\b/,
  /\bplatformMethod\b/,
  /\bplatform_agent\b/,
  /\bplatform_console\b/,
  /\bstorePages\b/,
  /\bstore_pages\b/,
  /\bstore_setup_progress\b/,
  /\benabledFeatures\b/,
  /\bprofile_settings\b/,
  /\b(?:logo_media_asset_id|favicon_media_asset_id|favicon_url|business_category)\b/,
  /\b(?:shipping_policy|return_policy|privacy_policy|terms_of_service|loyalty_policy)\b/,
  /upgrade your plan|feature upgrade/i,
];

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : extensions.has(extname(entry.name)) ? [path] : [];
  });
}

const violations = [];
for (const scanRoot of scanRoots) {
  for (const file of walk(join(root, scanRoot))) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/u);
    lines.forEach((line, index) => {
      forbidden.forEach((pattern) => {
        if (pattern.test(line)) violations.push(`${relative(root, file)}:${index + 1}: ${pattern.source}`);
      });
    });
  }
}

if (violations.length) {
  console.error('Single-store backend guard failed:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Single-store backend guard passed.');
