/**
 * S2.4 — Screen back header layout contract (test-side).
 *
 * Tier 3 / stack screens use shared `BackButton` or `ScreenBackHeader` with
 * `data-testid="screen-back-header"`. Top safe-area padding (`pt-safe-top`)
 * must live on an ancestor (AppShell content, stack overlay, or test wrapper) —
 * not duplicated on the back header itself.
 */
import * as React from 'react';
import { expect } from 'vitest';

export const SCREEN_BACK_HEADER_TEST_ID = 'screen-back-header';

/** Top safe-area inset class from tailwind.config.js */
export const SAFE_TOP_INSET_CLASS = 'pt-safe-top';

/** Simulates AppShell / stack overlay safe-top for isolated screen RTL. */
export function withSafeTopAncestor(ui: React.ReactElement): React.ReactElement {
  return React.createElement('div', { className: SAFE_TOP_INSET_CLASS }, ui);
}

/** iPhone 12/13/14 width — ticket viewport for Log Incident back visibility */
export const PHONE_VIEWPORT_WIDTH = 390;

/** iPhone 12/13/14 height */
export const PHONE_VIEWPORT_HEIGHT = 844;

export function hasSafeTopInset(className: string): boolean {
  return className.includes(SAFE_TOP_INSET_CLASS);
}

export function findSafeTopInsetRegion(start: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node !== null) {
    if (hasSafeTopInset(node.className)) return node;
    node = node.parentElement;
  }
  return null;
}

export function expectScreenBackHeader(header: HTMLElement): void {
  expect(header).toHaveAttribute('data-testid', SCREEN_BACK_HEADER_TEST_ID);
}

export function expectScreenBackHeaderHasSafeTop(header: HTMLElement): void {
  expectScreenBackHeader(header);
  expect(findSafeTopInsetRegion(header)).not.toBeNull();
}

/** Back control fully visible at scroll offset 0 within the given viewport height. */
export function expectBackControlVisibleWithoutScroll(
  control: HTMLElement,
  viewportHeight: number,
): void {
  expect(control).toBeVisible();
  const rect = control.getBoundingClientRect();
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.bottom).toBeLessThanOrEqual(viewportHeight);
}
