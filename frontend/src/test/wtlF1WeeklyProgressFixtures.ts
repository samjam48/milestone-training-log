/**
 * WTL.F1 — Dashboard This Week weekly progress test fixtures.
 * Aligns with WTL.B3 Monday–Sunday window and activity-scoped target labels.
 */
import type { WeeklyProgress } from '../lib/engine';
import type { ISODate } from '../types';

export const WTL_F1_PERIOD_START: ISODate = '2026-06-01';
export const WTL_F1_PERIOD_END: ISODate = '2026-06-07';

/** Expected frontend weekly-progress row after WTL.F1 mapper + B3 API contract. */
export type WeeklyProgressWtlF1 = WeeklyProgress & {
  activityId?: string | null;
  activityName?: string | null;
  periodStart: ISODate;
  periodEnd: ISODate;
};

export const legacyClassWeeklyProgress: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-class',
  activityClassId: 'cls-wtl-foot',
  className: 'WTL Foot Load',
  activityId: null,
  activityName: null,
  value: 3,
  target: 4,
  unit: 'sessions',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

export const activityScopedWeeklyProgress: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-walk',
  activityClassId: 'cls-wtl-foot',
  className: 'WTL Foot Load',
  activityId: 'act-wtl-walk',
  activityName: 'Morning Walk',
  value: 4.5,
  target: 8,
  unit: 'km',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

export const completeWeeklyProgress: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-complete',
  activityClassId: 'cls-wtl-foot',
  className: 'WTL Foot Load',
  activityId: 'act-wtl-bike',
  activityName: 'Stationary Bike',
  value: 60,
  target: 60,
  unit: 'minutes',
  state: 'neutral',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

export const overCompleteWeeklyProgress: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-over',
  activityClassId: 'cls-wtl-foot',
  className: 'WTL Foot Load',
  activityId: 'act-wtl-walk',
  activityName: 'Morning Walk',
  value: 12,
  target: 8,
  unit: 'km',
  state: 'danger',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

/** Snake-case dashboard weekly_progress row — activity-scoped with period metadata. */
export const weeklyProgressActivityScopedSnake = {
  weekly_target_id: activityScopedWeeklyProgress.weeklyTargetId,
  activity_class_id: activityScopedWeeklyProgress.activityClassId,
  class_name: activityScopedWeeklyProgress.className,
  activity_id: activityScopedWeeklyProgress.activityId,
  activity_name: activityScopedWeeklyProgress.activityName,
  value: activityScopedWeeklyProgress.value,
  target: activityScopedWeeklyProgress.target,
  unit: activityScopedWeeklyProgress.unit,
  state: activityScopedWeeklyProgress.state,
  period_start: WTL_F1_PERIOD_START,
  period_end: WTL_F1_PERIOD_END,
};

/** Snake-case dashboard weekly_progress row — legacy class-scoped target. */
export const weeklyProgressLegacyClassSnake = {
  weekly_target_id: legacyClassWeeklyProgress.weeklyTargetId,
  activity_class_id: legacyClassWeeklyProgress.activityClassId,
  class_name: legacyClassWeeklyProgress.className,
  activity_id: null,
  activity_name: null,
  value: legacyClassWeeklyProgress.value,
  target: legacyClassWeeklyProgress.target,
  unit: legacyClassWeeklyProgress.unit,
  state: legacyClassWeeklyProgress.state,
  period_start: WTL_F1_PERIOD_START,
  period_end: WTL_F1_PERIOD_END,
};
