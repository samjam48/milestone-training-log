/**
 * P25.2 — Centered modal layout contract (test-side).
 *
 * Settings class flows must use a shared centered modal (not bottom sheets):
 * fixed center alignment, max-w ~360–400px, max-h with internal scroll, scrim,
 * safe-area padding. See plans/tickets-stage-2-5-polish-followup-2026-06-06.md.
 */
import { expect } from 'vitest';

export const CENTERED_MODAL_PANEL_TEST_ID = 'centered-modal-panel';
export const CENTERED_MODAL_SCRIM_TEST_ID = 'centered-modal-scrim';
export const CENTERED_MODAL_SCROLL_TEST_ID = 'centered-modal-scroll';

/** Tailwind max-width tokens in the 360–400px band (inclusive). */
const CENTERED_MODAL_MAX_WIDTH_PATTERN =
  /\b(?:max-w-\[(?:36[0-9]|37[0-9]|38[0-9]|39[0-9]|400)px\]|max-w-sm)\b/;

const BOTTOM_SHEET_BOTTOM_ZERO_PATTERN = /\bbottom-0\b/;
const CENTERED_VERTICAL_PATTERN =
  /\b(?:top-1\/2|-translate-y-1\/2|items-center|justify-center)\b/;

export function hasCenteredModalMaxWidth(className: string): boolean {
  return CENTERED_MODAL_MAX_WIDTH_PATTERN.test(className);
}

export function isBottomSheetLayout(className: string): boolean {
  return (
    BOTTOM_SHEET_BOTTOM_ZERO_PATTERN.test(className)
    && /\binset-x-0\b/.test(className)
  );
}

export function hasCenteredVerticalAlignment(className: string): boolean {
  return CENTERED_VERTICAL_PATTERN.test(className);
}

export function findCenteredModalPanel(dialog: HTMLElement): HTMLElement | null {
  if (dialog.dataset.testid === CENTERED_MODAL_PANEL_TEST_ID) {
    return dialog;
  }
  return dialog.querySelector<HTMLElement>(
    `[data-testid="${CENTERED_MODAL_PANEL_TEST_ID}"]`,
  );
}

export function findCenteredModalScrollRegion(panel: HTMLElement): HTMLElement | null {
  const byTestId = panel.querySelector<HTMLElement>(
    `[data-testid="${CENTERED_MODAL_SCROLL_TEST_ID}"]`,
  );
  if (byTestId !== null) return byTestId;

  return findAncestor(panel, (el) => (
    /\boverflow-y-auto\b/.test(el.className)
    && /\bmax-h-/.test(el.className)
  ));
}

export function findCenteredModalScrim(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-testid="${CENTERED_MODAL_SCRIM_TEST_ID}"]`,
  );
}

export function findDragHandle(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    '[aria-hidden="true"].rounded-full.bg-border',
  );
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

export function expectCenteredModalDialog(dialog: HTMLElement): void {
  expect(dialog).toHaveAttribute('role', 'dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog.getAttribute('aria-label')).toBeTruthy();

  const panel = findCenteredModalPanel(dialog) ?? dialog;
  expect(panel).toHaveAttribute('data-testid', CENTERED_MODAL_PANEL_TEST_ID);
  expect(isBottomSheetLayout(panel.className)).toBe(false);
  expect(hasCenteredModalMaxWidth(panel.className)).toBe(true);

  const centeredRegion = findAncestor(panel, (el) => (
    hasCenteredVerticalAlignment(el.className)
    && /\bfixed\b/.test(el.className)
  ));
  expect(centeredRegion).not.toBeNull();

  const scrollRegion = findCenteredModalScrollRegion(panel);
  expect(scrollRegion).not.toBeNull();
  expect(scrollRegion?.className).toMatch(/\boverflow-y-auto\b/);
  expect(scrollRegion?.className).toMatch(/\bmax-h-/);

  const safeAreaRegion = findAncestor(panel, (el) => (
    /\bp(?:t|b|x|y)-safe\b/.test(el.className)
    || /\bpb-safe-bottom\b/.test(el.className)
    || /\bp-safe\b/.test(el.className)
  ));
  expect(safeAreaRegion).not.toBeNull();

  expect(findDragHandle(panel)).toBeNull();
}

export function expectCenteredModalScrim(): void {
  const scrim = findCenteredModalScrim();
  expect(scrim).not.toBeNull();
  expect(scrim).toHaveAttribute('aria-hidden', 'true');
  expect(scrim?.className).toMatch(/\bfixed\b/);
  expect(scrim?.className).toMatch(/\binset-0\b/);
}
