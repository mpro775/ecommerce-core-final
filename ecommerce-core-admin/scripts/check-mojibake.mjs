import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const extensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.sql', '.yaml', '.yml',
]);
const ignoredDirs = new Set([
  '.git', '.next', 'dist', 'node_modules', 'coverage', 'playwright-report', 'test-results',
]);
const suspiciousPatterns = [
  /\uFFFD/u,
  /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]/u,
  /\u00E2[\u0080-\u00BF]{2}|\u00F0[\u0080-\u00BF]{2,3}/u,
  /\u0637[\u00A1-\u00BF\u0152]/u,
  /\u0638[\u0080-\u00BF\u201A-\u2026\u0679]/u,
  /[\u00D8\u00D9]/u,
];

const failures = [];
const decoder = new TextDecoder('utf-8', { fatal: true });

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) await walk(path.join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;

    const filePath = path.join(directory, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    if (!extensions.has(extension) && entry.name !== '.env' && !entry.name.startsWith('.env.')) continue;

    let content;
    try {
      content = decoder.decode(await readFile(filePath));
    } catch {
      failures.push(`${path.relative(root, filePath)}: invalid UTF-8 byte sequence`);
      continue;
    }

    content.split(/\r?\n/u).forEach((line, index) => {
      if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
        failures.push(`${path.relative(root, filePath)}:${index + 1}: suspicious mojibake/replacement text`);
      }
    });
  }
}

await walk(root);

if (failures.length > 0) {
  console.error('UTF-8/mojibake verification failed:');
  console.error(failures.slice(0, 100).join('\n'));
  if (failures.length > 100) console.error(`...and ${failures.length - 100} more.`);
  process.exit(1);
}

console.log('UTF-8/mojibake verification passed.');

