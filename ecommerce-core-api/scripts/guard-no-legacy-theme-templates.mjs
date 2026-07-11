import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const forbiddenFiles = [
  join(root, 'src', 'themes', 'theme-section-registry.ts'),
  join(root, 'src', 'themes', 'theme-config.migrations.ts'),
  join(root, 'src', 'themes', 'theme-templates.ts'),
];
const forbiddenPatterns = [
  /renderer\s*[:=]\s*['"]sections['"]/i,
  /ThemeSections/,
  /theme-section-registry/,
  /hero_simple/,
  /product_grid_clean/,
  /product_compact_marketplace/,
];

for (const file of forbiddenFiles) {
  if (existsSync(file)) {
    console.error('Legacy theme template file must not exist:', file);
    process.exit(1);
  }
}

for (const file of collectFiles(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      console.error(`Legacy theme template reference ${pattern} found in:`, file);
      process.exit(1);
    }
  }
}

console.log('Legacy theme template backend guard passed.');

function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}
