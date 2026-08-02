import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.');
const adminRoot = path.resolve('..', 'ecommerce-core-admin');
const failures = [];

async function filesUnder(directory, extensions = ['.ts', '.tsx', '.js', '.mjs']) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(full, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) result.push(full);
  }
  return result;
}

async function assertNoPattern(files, pattern, message, allow = () => false) {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (pattern.test(source) && !allow(file, source)) {
      failures.push(`${message}: ${path.relative(root, file)}`);
    }
  }
}

const apiFiles = await filesUnder(path.join(root, 'src'));
const transitionFiles = apiFiles.filter((file) => /transition\.service\.ts$/u.test(file));
const commercialFiles = apiFiles.filter((file) =>
  /[\\/](orders|payments|inventory|promotions|loyalty|affiliates|storefront)[\\/]/u.test(file));
const adminCommercialFiles = (await filesUnder(path.join(adminRoot, 'src')))
  .filter((file) => /[\\/]merchant[\\/]panels[\\/](orders|payments)[\\/]/u.test(file));

await assertNoPattern(
  apiFiles,
  /UPDATE\s+orders\s+SET\s+status\s*=/isu,
  'Unapproved direct order status SQL',
  (file) => file.endsWith(path.join('orders', 'transitions', 'order-transition.service.ts')),
);
await assertNoPattern(
  transitionFiles,
  /enqueueStandalone\s*\(/u,
  'Commercial transition uses standalone Outbox',
);
await assertNoPattern(
  commercialFiles,
  /(?:dispatchEvent|triggerWebhook|sendWebhook)\s*\(/u,
  'Commercial path directly dispatches a webhook',
);
await assertNoPattern(
  commercialFiles.filter((file) => /orders|storefront|document-sequence/u.test(file)),
  /Math\.random\s*\(|randomBytes\s*\(|['"`]KS-/u,
  'Random or legacy order-number generation remains',
);
await assertNoPattern(
  commercialFiles.filter((file) => /controller\.ts$/u.test(file)),
  /(?:Patch|Put)\s*\(\s*['"`][^'"`]*status/u,
  'Generic status mutation endpoint remains',
);
await assertNoPattern(
  adminCommercialFiles,
  /toLocaleString\s*\(/u,
  'Bare toLocaleString remains in a commercial Admin panel',
);
await assertNoPattern(
  adminCommercialFiles,
  /(?:statusOptions|ORDER_STATUSES|PAYMENT_STATUSES|FULFILLMENT_STATUSES)\s*=/u,
  'Admin panel defines a local status source of truth',
);
await assertNoPattern(
  adminCommercialFiles,
  /<Select[^>]*(?:status|Status)|status[^\n]{0,80}<MenuItem/isu,
  'Admin arbitrary status selector remains',
);

const storefront = await readFile(path.join(root, 'src', 'storefront', 'storefront.service.ts'), 'utf8');
for (const required of [
  'listCartItemsInTransaction(db',
  'resolveStoreCurrencyInTransaction(',
  'listActiveMethodsAcrossZones(storeId, db)',
  'computeCheckoutDiscount(',
  'listStorefront(storeId, db)',
  'findById(\n        storeId,\n        (input as CheckoutDto).payerReceiptMediaAssetId!,\n        db,',
  'resolveCheckoutAttribution({',
  'db,',
]) {
  if (!storefront.includes(required)) failures.push(`Transaction-bound Checkout marker missing: ${required}`);
}

const migration099 = await readFile(
  path.join(root, 'migrations', '099_commercial_operations_hardening.up.sql'),
);
const hash099 = createHash('sha256').update(migration099).digest('hex').toUpperCase();
if (hash099 !== 'D7AA3620EAF8C8601818C6D406304A3E024677F9EB909B07CAE27534B625CBC0') {
  failures.push(`Historical migration 099 changed (SHA256=${hash099})`);
}

if (failures.length > 0) {
  console.error('Commercial contract guard failed:');
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Commercial contract guard passed (${apiFiles.length} API files, ${adminCommercialFiles.length} Admin panel files; migration 099 immutable).`);
