/**
 * P25.6 — Rule taxonomy: plain labels & distinct helpers (test-side contract).
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 */
import { expect } from 'vitest';

export {
  CLASS_ADD_RULE_TYPES as P25_6_CLASS_ADD_RULE_TYPES,
  EXERCISE_ADD_RULE_TYPES as P25_6_EXERCISE_ADD_RULE_TYPES,
  HIDDEN_RULE_TYPES as P25_6_EXCLUDED_ADD_RULE_TYPES,
  RULE_LABELS as P25_6_RULE_LABELS,
} from '../lib/ruleTaxonomy';

/** One-line helper copy distinguishing rest vs quota vs streak. */
export const P25_6_RULE_HELPERS = {
  rest_between_class:
    /wait at least.*days after your last session in this class before doing it again/i,
  frequency_limit: /at most.*sessions in this class in any 7-day period/i,
  consecutive_day_limit:
    /no more than.*days in a row with a session in this class/i,
} as const;

export function getSelectOptionValues(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map(
    (option) => option.getAttribute('value') ?? '',
  );
}

export function getSelectOptionLabels(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map(
    (option) => option.textContent?.trim() ?? '',
  );
}

export function expectAddRulePickerExcludesLoadCap(select: HTMLElement): void {
  const values = getSelectOptionValues(select);
  for (const excluded of ['weekly_load_cap', 'weekly_activity_count'] as const) {
    expect(values).not.toContain(excluded);
  }
  expect(values).not.toContain('Weekly load cap');
}

export function expectAddRulePickerValues(
  select: HTMLElement,
  expected: readonly string[],
): void {
  expect(getSelectOptionValues(select)).toEqual([...expected]);
}

export function expectAddRulePickerLabels(
  select: HTMLElement,
  expectedLabels: readonly string[],
): void {
  expect(getSelectOptionLabels(select)).toEqual([...expectedLabels]);
}
