/**
 * S2.1 — Bottom inset layout contract (test-side).
 *
 * Tab screens: AppShell reserves tabbar + safe-bottom (`TAB_BAR_SAFE_BOTTOM_INSET`).
 * Footers use `data-testid="bottom-action-bar"` + shrink-0 styling only — no duplicate calc.
 * Overlays: AppShell uses `SAFE_BOTTOM_ONLY_INSET`; submit regions use safe-bottom on the control.
 */
import { expect } from 'vitest';

/** Tab bar visible: reserve tab bar height + device safe area (AppShell). */
export const TAB_BAR_SAFE_BOTTOM_INSET =
  'pb-[calc(theme(spacing.tabbar)+theme(spacing.safe-bottom))]';

/** Full-screen overlay / stack: safe area only (no tab bar). */
export const SAFE_BOTTOM_ONLY_INSET = 'pb-safe-bottom';

export const BOTTOM_ACTION_BAR_TEST_ID = 'bottom-action-bar';

/** Prefer small-viewport height over dynamic viewport on AppShell. */
export const APPSHELL_VIEWPORT_HEIGHT_CLASS = 'h-[100svh]';

const TAB_BAR_INSET_CLASS_PATTERN =
  /pb-\[calc\(theme\(spacing\.tabbar\)\+theme\(spacing\.safe-bottom\)\)\]/;

export function hasTabBarBottomInset(className: string): boolean {
  return TAB_BAR_INSET_CLASS_PATTERN.test(className);
}

export function hasSafeBottomOnlyInset(className: string): boolean {
  return (
    className.includes(SAFE_BOTTOM_ONLY_INSET) &&
    !className.includes('spacing.tabbar')
  );
}

export function expectTabBarBottomInset(element: HTMLElement): void {
  expect(hasTabBarBottomInset(element.className)).toBe(true);
}

export function expectSafeBottomOnlyInset(element: HTMLElement): void {
  expect(hasSafeBottomOnlyInset(element.className)).toBe(true);
}

/** Tab-screen footer must not duplicate AppShell padding. */
export function expectTabScreenBottomActionBar(actionBar: HTMLElement): void {
  expect(actionBar).toHaveAttribute('data-testid', BOTTOM_ACTION_BAR_TEST_ID);
  expect(hasTabBarBottomInset(actionBar.className)).toBe(false);
  expect(actionBar.className).toMatch(/shrink-0/);
}

/**
 * Tab-screen CTA: inset on an ancestor (typically AppShell), not on the footer.
 */
export function expectTabBarInsetAboveTabScreenFooter(actionBar: HTMLElement): void {
  expectTabScreenBottomActionBar(actionBar);
  const region = findTabBarInsetRegion(actionBar);
  expect(region).not.toBeNull();
  expect(region).not.toBe(actionBar);
}

/** Walk ancestors until `predicate` matches (inclusive of start). */
export function findAncestor(
  start: HTMLElement,
  predicate: (el: HTMLElement) => boolean,
): HTMLElement | null {
  let node: HTMLElement | null = start;
  while (node !== null) {
    if (predicate(node)) return node;
    node = node.parentElement;
  }
  return null;
}

export function findTabBarInsetRegion(start: HTMLElement): HTMLElement | null {
  return findAncestor(start, (el) => hasTabBarBottomInset(el.className));
}

export function findSafeBottomOnlyRegion(start: HTMLElement): HTMLElement | null {
  return findAncestor(start, (el) => hasSafeBottomOnlyInset(el.className));
}
