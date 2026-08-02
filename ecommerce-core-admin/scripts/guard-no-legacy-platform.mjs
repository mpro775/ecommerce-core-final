import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbidden = [
  /\bStoreCapabilities(?:Module|Service)\b/,
  /\bStoreReadiness\w*\b/,
  /merchant\/store-readiness/i,
  /\bonboardingCompleted\b/,
  /\bplatformPaymentMethodId\b/,
  /\bPlatformPaymentMethod\b/,
  /\bplatformMethod\b/,
  /\bplatform_agent\b/,
  /\bplatform_console\b/,
  /\bFeatureGate\b|\bLockedFeaturePage\b|\buseFeatureGate\b/,
  /upgrade your plan|feature upgrade/i,
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
  console.error('Legacy platform guard failed:');
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Legacy platform guard passed.');

