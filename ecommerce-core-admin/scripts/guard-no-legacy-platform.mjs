#!/usr/bin/env node
/**
 * Guard script: prevents re-introduction of legacy Platform admin patterns.
 * Run via: npm run guard:legacy-platform
 * Add to CI pipeline to enforce the constraint continuously.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const FORBIDDEN_PATTERNS = [
  /\bplatform-admin\b/i,
  /\bPlatformAdmin\b/,
  /\bPLATFORM_ADMIN\b/,
  /\bplatformSuperAdmin\b/,
  /\bPlatformSuperAdmin\b/,
  /\bplatform-seed\b/i,
  /\bPlatformModule\b/,
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'scripts']);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        results.push(...walk(fullPath));
      }
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

const srcDir = join(process.cwd(), 'src');
const files = walk(srcDir);
const violations = [];

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(lines[i])) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: pattern.source,
          content: lines[i].trim(),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} legacy Platform reference(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    Content: ${v.content}\n`);
  }
  console.error('Legacy Platform patterns must not be re-introduced.');
  console.error('Remove the offending code before committing.\n');
  process.exit(1);
} else {
  console.log('✅ No legacy Platform patterns found.');
  process.exit(0);
}
