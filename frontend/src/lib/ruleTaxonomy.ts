import type { RuleType } from '../types';

/** Owner-signed user-facing row / picker labels (not engine rule_type strings). */
export const RULE_LABELS: Record<
  | 'rest_between_class'
  | 'frequency_limit'
  | 'consecutive_day_limit'
  | 'weekly_volume_cap'
  | 'daily_volume_cap',
  string
> = {
  rest_between_class: 'Minimum days between sessions',
  frequency_limit: 'Maximum sessions per week',
  consecutive_day_limit: 'Maximum consecutive days',
  weekly_volume_cap: 'Maximum volume per week',
  daily_volume_cap: 'Maximum volume per day',
};

/** One-line helper copy distinguishing rest vs quota vs streak. */
export const RULE_HELPERS: Record<
  | 'rest_between_class'
  | 'frequency_limit'
  | 'consecutive_day_limit',
  string
> = {
  rest_between_class:
    'Wait at least this many days after your last session in this class before doing it again.',
  frequency_limit:
    'At most this many sessions in this class in any 7-day period.',
  consecutive_day_limit:
    'No more than this many days in a row with a session in this class.',
};

/** Class add-rule picker: spacing/frequency only (no load cap). */
export const CLASS_ADD_RULE_TYPES = [
  'rest_between_class',
  'frequency_limit',
  'consecutive_day_limit',
] as const satisfies readonly RuleType[];

/** Units offered when creating or editing exercise volume-cap rules (P25.7). */
export const VOLUME_CAP_UNITS = ['km', 'minutes', 'hours'] as const;

/** Exercise add-rule picker: spacing + daily/weekly volume caps. */
export const EXERCISE_ADD_RULE_TYPES = [
  'rest_between_class',
  'frequency_limit',
  'consecutive_day_limit',
  'weekly_volume_cap',
  'daily_volume_cap',
] as const satisfies readonly RuleType[];

/** Rule types hidden from Settings block summary and add pickers. */
export const HIDDEN_RULE_TYPES = [
  'weekly_load_cap',
  'weekly_activity_count',
] as const satisfies readonly RuleType[];

export function getRuleLabel(ruleType: RuleType): string {
  if (ruleType in RULE_LABELS) {
    return RULE_LABELS[ruleType as keyof typeof RULE_LABELS];
  }
  if (ruleType === 'weekly_load_cap') {
    return 'Weekly load cap';
  }
  return ruleType;
}

export function isVolumeCapRule(ruleType: RuleType): boolean {
  return ruleType === 'weekly_volume_cap' || ruleType === 'daily_volume_cap';
}

export function getRuleHelper(ruleType: RuleType): string | undefined {
  if (ruleType in RULE_HELPERS) {
    return RULE_HELPERS[ruleType as keyof typeof RULE_HELPERS];
  }
  return undefined;
}

export function formatSettingsRuleSummary(
  ruleType: RuleType,
  thresholdValue: number,
): string | null {
  if ((HIDDEN_RULE_TYPES as readonly string[]).includes(ruleType)) {
    return null;
  }
  if (ruleType in RULE_LABELS) {
    const label = RULE_LABELS[ruleType as keyof typeof RULE_LABELS];
    if (ruleType === 'frequency_limit') {
      return `${label} · ${thresholdValue}`;
    }
    return `${label} · ${thresholdValue}`;
  }
  return ruleType;
}
