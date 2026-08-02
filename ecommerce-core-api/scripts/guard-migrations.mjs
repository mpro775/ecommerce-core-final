import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve('migrations');
const files = await readdir(migrationsDir);
const upFiles = files.filter((file) => file.endsWith('.up.sql')).sort();
const downFiles = new Set(files.filter((file) => file.endsWith('.down.sql')));
const allowedDuplicatePrefixes = new Set(['021', '036', '041', '073', '080']);
const byPrefix = new Map();
const failures = [];

for (const upFile of upFiles) {
  const downFile = upFile.replace('.up.sql', '.down.sql');
  if (!downFiles.has(downFile)) failures.push(`Missing down migration for ${upFile}`);

  const prefix = upFile.slice(0, 3);
  byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), upFile]);

  const sql = await readFile(path.join(migrationsDir, upFile), 'utf8');
  if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/imu.test(sql)) {
    failures.push(`${upFile} contains transaction control owned by the runner`);
  }
}

for (const [prefix, names] of byPrefix) {
  if (names.length > 1 && !allowedDuplicatePrefixes.has(prefix)) {
    failures.push(`Duplicate migration prefix ${prefix}: ${names.join(', ')}`);
  }
}
if ((byPrefix.get('098') ?? []).length !== 1) failures.push('Migration prefix 098 must be unique');

if (failures.length) {
  console.error('Migration guard failed:');
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Migration guard passed (${upFiles.length} migration pairs; 098 unique).`);

