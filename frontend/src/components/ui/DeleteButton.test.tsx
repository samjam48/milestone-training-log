/**
 * Shared DeleteButton (bin icon) for row triggers
 *
 * Acceptance criteria (component unit tests — static source analysis):
 *   1. DeleteButton.tsx exists at components/ui/DeleteButton.tsx
 *   2. It exports a DeleteButton component
 *   3. Its source uses a danger/red colour class (text-danger-fg)
 *   4. Its source has a ≥44px touch target class (min-w-11 / min-h-11)
 *   5. It is an icon button — does NOT put "Delete" as visible JSX text content
 *   6. aria-label is required in its prop type (not optional)
 *
 * Static source analysis is used so the suite can load and produce meaningful
 * failures before the file exists. Vite resolves all imports (including dynamic
 * ones) at transform time, so render tests for this not-yet-created component
 * live in the integration file (DeleteButton.rowTriggerIntegration.test.tsx), which imports only
 * the already-existing screen files.
 *
 * These tests describe expected behavior.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const DELETE_BUTTON_PATH = resolve(UI_DIR, 'DeleteButton.tsx');

function readDeleteButtonSource(): string {
  if (existsSync(DELETE_BUTTON_PATH)) {
    return readFileSync(DELETE_BUTTON_PATH, 'utf8');
  }
  return '';
}

// ---------------------------------------------------------------------------
// AC1 — file exists
// ---------------------------------------------------------------------------

describe('DeleteButton — AC1: file exists at components/ui/DeleteButton.tsx', () => {
  it('DeleteButton.tsx exists', () => {
    expect(existsSync(DELETE_BUTTON_PATH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2 — exports a DeleteButton component
// ---------------------------------------------------------------------------

describe('DeleteButton — AC2: exports DeleteButton', () => {
  it('source exports a DeleteButton function or const', () => {
    const src = readDeleteButtonSource();
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/export (function|const) DeleteButton/);
  });
});

// ---------------------------------------------------------------------------
// AC3 — danger colour class
// ---------------------------------------------------------------------------

describe('DeleteButton — AC3: uses text-danger-fg colour class', () => {
  it('source contains text-danger-fg (faded-red icon, full colour on hover)', () => {
    const src = readDeleteButtonSource();
    expect(src).toContain('text-danger-fg');
  });
});

// ---------------------------------------------------------------------------
// AC4 — ≥44px touch target
// ---------------------------------------------------------------------------

describe('DeleteButton — AC4: ≥44px touch target class', () => {
  it('source contains min-w-11 (44px minimum width)', () => {
    const src = readDeleteButtonSource();
    expect(src).toContain('min-w-11');
  });

  it('source contains min-h-11 (44px minimum height)', () => {
    const src = readDeleteButtonSource();
    expect(src).toContain('min-h-11');
  });
});

// ---------------------------------------------------------------------------
// AC5 — icon button: does not put "Delete" as rendered text content
// ---------------------------------------------------------------------------

describe('DeleteButton — AC5: icon button — no visible "Delete" text', () => {
  it('source does not contain bare >Delete< JSX text (must be icon, not text label)', () => {
    const src = readDeleteButtonSource();
    // The button must use an icon (SVG / icon component), not the word "Delete".
    // A bare >Delete< pattern would mean it renders visible text, violating the spec.
    expect(src).not.toMatch(/>\s*Delete\s*</);
  });
});

// ---------------------------------------------------------------------------
// AC6 — aria-label is required in the prop type
// ---------------------------------------------------------------------------

describe('DeleteButton — AC6: aria-label is required (not optional)', () => {
  it('prop type does not mark aria-label as optional (no aria-label?:)', () => {
    const src = readDeleteButtonSource();
    // If aria-label were optional it would appear as `'aria-label'?:` or `ariaLabel?:`
    expect(src).not.toMatch(/'aria-label'\?:/);
    expect(src).not.toMatch(/ariaLabel\?:/);
  });

  it('prop type includes a required aria-label declaration', () => {
    const src = readDeleteButtonSource();
    // Must have an explicit required aria-label in the interface/type
    expect(src).toMatch(/'aria-label':|ariaLabel:/);
  });
});

// ---------------------------------------------------------------------------
// Barrel export — DeleteButton is re-exported from components/ui/index.ts
// ---------------------------------------------------------------------------

describe('DeleteButton — barrel export: re-exported from ui/index.ts', () => {
  const INDEX_PATH = resolve(UI_DIR, 'index.ts');

  it('ui/index.ts exports DeleteButton', () => {
    const indexSrc = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';
    expect(indexSrc).toMatch(/DeleteButton/);
  });
});
