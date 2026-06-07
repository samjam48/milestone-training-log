/**
 * P25.5 — Date picker compact popover layout contract (test-side).
 *
 * LogActivityScreen create/edit must anchor a content-sized calendar popover to
 * the date field (not a full-width bottom sheet). See
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md.
 */
import { expect } from 'vitest';

export const DATE_PICKER_FIELD_TEST_ID = 'log-date-field';
export const DATE_PICKER_POPOVER_TEST_ID = 'date-picker-popover';

const BOTTOM_SHEET_PATTERN = /\bbottom-0\b.*\binset-x-0\b|\binset-x-0\b.*\bbottom-0\b/;

/** Content-sized width tokens — popover must not span the viewport. */
const COMPACT_WIDTH_PATTERN =
  /\b(?:w-fit|w-auto|inline-block|max-w-\[(?:2[4-9]|[3-9]\d|\d{3,})px\]|max-w-xs|max-w-sm)\b/;

export function isDatePickerBottomSheet(className: string): boolean {
  return BOTTOM_SHEET_PATTERN.test(className);
}

export function isCompactPopoverWidth(className: string): boolean {
  if (/\binset-x-0\b/.test(className)) return false;
  if (/\bw-full\b/.test(className) && !COMPACT_WIDTH_PATTERN.test(className)) {
    return false;
  }
  return COMPACT_WIDTH_PATTERN.test(className);
}

export function findDatePickerPopover(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-testid="${DATE_PICKER_POPOVER_TEST_ID}"]`,
  );
}

export function findDatePickerField(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-testid="${DATE_PICKER_FIELD_TEST_ID}"]`,
  );
}

export function findDatePickerScrim(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="date-picker-scrim"]');
}

export function findDragHandle(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    '[aria-hidden="true"].rounded-full.bg-border',
  );
}

export function expectDatePickerPopoverAssociated(
  field: HTMLElement,
  popover: HTMLElement,
): void {
  expect(field).toHaveAttribute('aria-expanded', 'true');
  const controlsId = field.getAttribute('aria-controls');
  expect(controlsId).toBeTruthy();
  expect(popover.id).toBe(controlsId);
  expect(field).toHaveAttribute('aria-haspopup');
}

export function expectCompactDatePickerPopover(popover: HTMLElement): void {
  expect(popover).toHaveAttribute('data-testid', DATE_PICKER_POPOVER_TEST_ID);
  expect(isDatePickerBottomSheet(popover.className)).toBe(false);
  expect(popover.className).not.toMatch(/\brounded-t-2xl\b/);
  expect(isCompactPopoverWidth(popover.className)).toBe(true);
  expect(findDragHandle(popover)).toBeNull();
}
