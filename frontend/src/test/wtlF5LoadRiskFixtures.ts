/**
 * WTL.F5 — Load risk rule-limit row UI fixtures.
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F5
 *
 * Target frontend shape after WTL.B6 API contract + F5 mapper/UI.
 */
import { addDays, eachDay } from '../lib/load';
import type { SafetyState } from '../types';
import type { ISODate } from '../types';

export const WTL_F5_AS_OF: ISODate = '2026-05-25';
export const WTL_F5_CLASS_ID = 'cls-foot';
export const WTL_F5_CLASS_NAME = 'High-Intensity Foot Load';
export const WTL_F5_WALK_ID = 'act-walk';
export const WTL_F5_BIKE_ID = 'act-bike';

export const WTL_F5_EMPTY_COPY = /no load rules are configured/i;

/** WTL.F5 engine-layer day cell — load-tax state drives strip color. */
export type LoadRiskDayWtlF5 = {
  date: ISODate;
  flagged: boolean;
  state: SafetyState;
};

export type LoadRiskRuleLimitRowWtlF5 = {
  id: string;
  scope: 'class' | 'activity';
  ruleId: string;
  ruleType: string;
  activityClassId: string;
  className: string;
  actual: number;
  limit: number;
  unit: string;
  state: SafetyState;
  label: string;
  activityId?: string | null;
  activityName?: string | null;
  displayMode?: 'bar' | 'status';
};

export type LoadRiskSummaryWtlF5 = {
  weekDays: LoadRiskDayWtlF5[];
  ruleLimitRows: LoadRiskRuleLimitRowWtlF5[];
};

const WTL_F5_WEEK_START = addDays(WTL_F5_AS_OF, -6);

/** Rolling seven-day strip with mixed load-tax states. */
export const wtlF5WeekDays: LoadRiskDayWtlF5[] = eachDay(WTL_F5_WEEK_START, WTL_F5_AS_OF).map(
  (date, index) => {
    const states: SafetyState[] = [
      'safe',
      'safe',
      'caution',
      'caution',
      'danger',
      'safe',
      'caution',
    ];
    const state = states[index] ?? 'safe';
    return {
      date,
      flagged: state !== 'safe',
      state,
    };
  },
);

export const wtlF5ClassFrequencyRow: LoadRiskRuleLimitRowWtlF5 = {
  id: 'row-freq-foot',
  scope: 'class',
  ruleId: 'rule-freq-foot',
  ruleType: 'frequency_limit',
  activityClassId: WTL_F5_CLASS_ID,
  className: WTL_F5_CLASS_NAME,
  actual: 4,
  limit: 3,
  unit: 'sessions',
  state: 'danger',
  label: 'Class sessions (7 days)',
  displayMode: 'bar',
};

export const wtlF5ClassRestRow: LoadRiskRuleLimitRowWtlF5 = {
  id: 'row-rest-foot',
  scope: 'class',
  ruleId: 'rule-rest-foot',
  ruleType: 'rest_between_class',
  activityClassId: WTL_F5_CLASS_ID,
  className: WTL_F5_CLASS_NAME,
  actual: 1,
  limit: 3,
  unit: 'days',
  state: 'danger',
  label: '1 day since last session — need 3 days rest',
  displayMode: 'status',
};

export const wtlF5ClassConsecutiveRow: LoadRiskRuleLimitRowWtlF5 = {
  id: 'row-consec-foot',
  scope: 'class',
  ruleId: 'rule-consec-foot',
  ruleType: 'consecutive_day_limit',
  activityClassId: WTL_F5_CLASS_ID,
  className: WTL_F5_CLASS_NAME,
  actual: 2,
  limit: 2,
  unit: 'days',
  state: 'danger',
  label: 'Consecutive class days',
  displayMode: 'bar',
};

export const wtlF5WalkWeeklyVolumeRow: LoadRiskRuleLimitRowWtlF5 = {
  id: 'row-vol-walk',
  scope: 'activity',
  ruleId: 'rule-vol-walk-weekly',
  ruleType: 'weekly_volume_cap',
  activityClassId: WTL_F5_CLASS_ID,
  className: WTL_F5_CLASS_NAME,
  activityId: WTL_F5_WALK_ID,
  activityName: 'Morning Walk',
  actual: 7,
  limit: 8,
  unit: 'km',
  state: 'caution',
  label: 'Morning Walk weekly volume',
  displayMode: 'bar',
};

export const wtlF5BikeDailyVolumeRow: LoadRiskRuleLimitRowWtlF5 = {
  id: 'row-vol-bike',
  scope: 'activity',
  ruleId: 'rule-vol-bike-daily',
  ruleType: 'daily_volume_cap',
  activityClassId: WTL_F5_CLASS_ID,
  className: WTL_F5_CLASS_NAME,
  activityId: WTL_F5_BIKE_ID,
  activityName: 'Stationary Bike',
  actual: 20,
  limit: 45,
  unit: 'minutes',
  state: 'safe',
  label: 'Stationary Bike today',
  displayMode: 'bar',
};

/** Owner-style foot-load scenario — multiple rule rows under one class group. */
export const wtlF5FootLoadRuleRows: LoadRiskRuleLimitRowWtlF5[] = [
  wtlF5ClassFrequencyRow,
  wtlF5ClassRestRow,
  wtlF5ClassConsecutiveRow,
  wtlF5WalkWeeklyVolumeRow,
  wtlF5BikeDailyVolumeRow,
];

export const wtlF5FootLoadSummary: LoadRiskSummaryWtlF5 = {
  weekDays: wtlF5WeekDays,
  ruleLimitRows: wtlF5FootLoadRuleRows,
};

export const wtlF5EmptySummary: LoadRiskSummaryWtlF5 = {
  weekDays: wtlF5WeekDays,
  ruleLimitRows: [],
};

function rowToSnake(row: LoadRiskRuleLimitRowWtlF5): Record<string, unknown> {
  return {
    id: row.id,
    scope: row.scope,
    rule_id: row.ruleId,
    rule_type: row.ruleType,
    activity_class_id: row.activityClassId,
    class_name: row.className,
    actual: row.actual,
    limit: row.limit,
    unit: row.unit,
    state: row.state,
    label: row.label,
    activity_id: row.activityId ?? null,
    activity_name: row.activityName ?? null,
    display_mode: row.displayMode ?? 'bar',
  };
}

/** Snake-case dashboard load_risk_summary — WTL.B6 contract. */
export const wtlF5FootLoadSummarySnake = {
  week_days: wtlF5WeekDays.map((day) => ({
    date: day.date,
    flagged: day.flagged,
    state: day.state,
  })),
  rule_limit_rows: wtlF5FootLoadRuleRows.map(rowToSnake),
};

export const wtlF5EmptySummarySnake = {
  week_days: wtlF5WeekDays.map((day) => ({
    date: day.date,
    flagged: day.flagged,
    state: day.state,
  })),
  rule_limit_rows: [],
};
