/**
 * P25.7 — Exercise-only volume caps with units (test-side contract).
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 */
import { expect } from 'vitest';

/** Units offered when creating or editing exercise volume-cap rules. */
export const P25_7_VOLUME_CAP_UNITS = ['km', 'minutes', 'hours'] as const;

export type P25_7VolumeCapUnit = (typeof P25_7_VOLUME_CAP_UNITS)[number];

export function expectVolumeCapUnitPickerOptions(select: HTMLElement): void {
  expect(getSelectOptionValues(select)).toEqual([...P25_7_VOLUME_CAP_UNITS]);
}

export function getSelectOptionValues(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map(
    (option) => option.getAttribute('value') ?? '',
  );
}
