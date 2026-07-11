#!/usr/bin/env node
/**
 * Guard script: prevents re-introduction of legacy theme template patterns.
 * Run via: npm run guard:legacy-theme-templates
 * Add to CI pipeline to enforce the constraint continuously.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const FORBIDDEN_PATTERNS = [
  /\bThemeTemplate\b/,
  /\bThemeVersion\b/,
  /\bThemeState\b/,
  /\bThemeTemplateCategory\b/,
  /\bPreviewTokenResponse\b/,
  /\bsf_theme_/,
  /\bVITE_STOREFRONT_URL_PATTERN\b/,
  /\bbuildDefaultStoreUrl\b/,
  /\bSTOREFRONT_BASE_URL\b/,
  /\bVITE_STOREFRONT_BASE_URL\b/,
  /\bVITE_SF_VISUAL_BUILDER_ENABLED\b/,
  /\bVITE_SF_ROLLOUT_STAGE\b/,
  /\bThemesModule\b/,
  /\bDomainsModule\b/,
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
  console.error(`\n❌ Found ${violations.length} legacy theme template reference(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    Content: ${v.content}\n`);
  }
  console.error('Legacy theme/template/storefront patterns must not be re-introduced.');
  console.error('Remove the offending code before committing.\n');
  process.exit(1);
} else {
  console.log('✅ No legacy theme template patterns found.');
  process.exit(0);
}
