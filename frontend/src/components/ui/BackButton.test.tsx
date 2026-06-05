/**
 * S2.4 — Shared BackButton / ScreenBackHeader component contract.
 * plans/tickets-stage-2-polish-2026-06-05.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SAFE_TOP_INSET_CLASS,
  SCREEN_BACK_HEADER_TEST_ID,
} from '../../test/screenBackLayout';

const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const BACK_BUTTON_PATH = resolve(UI_DIR, 'BackButton.tsx');
const SCREEN_BACK_HEADER_PATH = resolve(UI_DIR, 'ScreenBackHeader.tsx');

function readSharedBackSource(): string {
  if (existsSync(BACK_BUTTON_PATH)) {
    return readFileSync(BACK_BUTTON_PATH, 'utf8');
  }
  if (existsSync(SCREEN_BACK_HEADER_PATH)) {
    return readFileSync(SCREEN_BACK_HEADER_PATH, 'utf8');
  }
  return '';
}

describe('S2.4 — shared BackButton component', () => {
  it('lives at components/ui/BackButton.tsx or ScreenBackHeader.tsx', () => {
    const hasSharedFile =
      existsSync(BACK_BUTTON_PATH) || existsSync(SCREEN_BACK_HEADER_PATH);
    expect(hasSharedFile).toBe(true);
  });

  it('exports a shared back control with screen-back-header test id', () => {
    const src = readSharedBackSource();
    expect(src.length).toBeGreaterThan(0);
    expect(src).toMatch(/export (function|const) (BackButton|ScreenBackHeader)/);
    expect(src).toContain(`data-testid="${SCREEN_BACK_HEADER_TEST_ID}"`);
  });

  it('does not duplicate pt-safe-top on the header (ancestor provides inset)', () => {
    const src = readSharedBackSource();
    const headerClassMatch = src.match(
      /data-testid="screen-back-header"\s+className="([^"]+)"/,
    );
    expect(headerClassMatch).not.toBeNull();
    expect(headerClassMatch![1]).not.toContain(SAFE_TOP_INSET_CLASS);
  });
});
