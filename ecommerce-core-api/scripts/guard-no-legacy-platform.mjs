import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectTsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectTsFiles(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const root = process.cwd();
const legacyController = join(root, 'src', 'saas', 'platform-admin.controller.ts');
if (existsSync(legacyController)) {
  console.error('Legacy platform admin controller must not exist:', legacyController);
  process.exit(1);
}

const files = collectTsFiles(join(root, 'src'));
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('platform-admin.controller')) {
    console.error('Legacy controller reference found in:', file);
    process.exit(1);
  }
}

console.log('Legacy platform backend guard passed.');
