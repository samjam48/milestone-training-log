/**
 * F1.4 — Vitest coverage threshold config (written before implementation).
 *
 * Fails until frontend/vitest.config.ts enables coverage with ≥70% thresholds
 * scoped to frontend/src/lib/api/ and frontend/src/hooks/.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const VITEST_CONFIG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../vitest.config.ts',
);

function readVitestConfigSource(): string {
  return readFileSync(VITEST_CONFIG_PATH, 'utf8');
}

describe('F1.4 vitest coverage thresholds', () => {
  it('configures coverage thresholds at ≥70% for lib/api and hooks', () => {
    const source = readVitestConfigSource();

    expect(source).toMatch(/coverage\s*:/);
    expect(source).toMatch(/thresholds\s*:/);
    expect(source).toMatch(/(?:lines|statements)\s*:\s*7[0-9]|(?:lines|statements)\s*:\s*8[0-9]|(?:lines|statements)\s*:\s*9[0-9]|(?:lines|statements)\s*:\s*100/);
    expect(source).toMatch(/lib\/api/);
    expect(source).toMatch(/hooks/);
  });

  it('excludes test fixtures from coverage include set', () => {
    const source = readVitestConfigSource();

    expect(source).toMatch(/testFixtures|exclude/);
  });
});
