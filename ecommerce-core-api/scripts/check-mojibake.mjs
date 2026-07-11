import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const ignoredDirs = new Set([
  '.git',
  '.next',
  'dist',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
]);
const mojibakePatterns = [
  /\u0637[\u00A1-\u00BF\u0152]/u,
  /\u0638[\u0080-\u00BF\u201A-\u2026\u0679]/u,
  /\u00C3[\u0080-\u00BF]|\u00E2[\u0080-\u00BF]/u,
  /أ¢|â‚¬|â€|â€œ|â€‌|â€”/u,
];

const matches = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(path.join(dir, entry.name));
      }
      continue;
    }

    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) {
      continue;
    }

    const filePath = path.join(dir, entry.name);
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
      if (mojibakePatterns.some((pattern) => pattern.test(line))) {
        matches.push(`${path.relative(root, filePath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

await walk(root);

if (matches.length > 0) {
  console.error('Mojibake-like text was found. Fix the source text before merging:');
  console.error(matches.slice(0, 80).join('\n'));
  if (matches.length > 80) {
    console.error(`...and ${matches.length - 80} more matches.`);
  }
  process.exit(1);
}

console.log('No mojibake-like text found.');
