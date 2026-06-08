/**
 * WRU.F2 — grep-clean guardrails for removed block-create UX (failing first, TDD).
 * plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F2
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FRONTEND_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = [
  join(FRONTEND_SRC, 'components/screens'),
  join(FRONTEND_SRC, 'App.tsx'),
  join(FRONTEND_SRC, 'hooks/useMilestoneEngine.ts'),
  join(FRONTEND_SRC, 'lib/api/trainingBlocks.ts'),
];

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'New Training Block copy', pattern: /new training block/i },
  { label: 'Training Block section header', pattern: /^[^/\n]*training block[^/\n]*$/im },
  { label: 'block start date picker label', pattern: /labelText\([^)]*start date/i },
  { label: 'block end date picker label', pattern: /labelText\([^)]*end date/i },
  { label: 'onNewBlock callback prop', pattern: /\bonNewBlock\b/ },
  { label: 'new-training-block route key', pattern: /new-training-block/ },
];

const ALLOWED_FILES = new Set([
  'NewTrainingBlockScreen.test.tsx',
  'App.wruF2.test.tsx',
  'wruF2GrepClean.test.ts',
  'SettingsScreen.test.tsx',
  'App.test.tsx',
  'App.screenBack.test.tsx',
  'useMilestoneEngine.test.tsx',
  'useMilestoneEngine.wtlF7.test.tsx',
  'trainingBlocks.test.ts',
  'apiResources.test.ts',
  'mockEngine.ts',
]);

function collectSourceFiles(path: string): string[] {
  const stats = statSync(path);
  if (stats.isFile()) {
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(path)) {
    const child = join(path, entry);
    if (entry === 'node_modules' || entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
      continue;
    }
    files.push(...collectSourceFiles(child));
  }
  return files;
}

describe('WRU.F2 — grep-clean production surfaces', () => {
  it('frontend production sources omit removed block-create strings', () => {
    const offenders: string[] = [];

    for (const root of SCAN_ROOTS) {
      for (const filePath of collectSourceFiles(root)) {
        const basename = filePath.split('/').pop() ?? filePath;
        if (ALLOWED_FILES.has(basename)) continue;

        const src = readFileSync(filePath, 'utf8');
        for (const { label, pattern } of FORBIDDEN_PATTERNS) {
          if (pattern.test(src)) {
            offenders.push(`${basename}: ${label}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
