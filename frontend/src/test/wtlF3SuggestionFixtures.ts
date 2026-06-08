/**
 * WTL.F3 — Weekly target suggestions UI copy test fixtures.
 * Aligns with WTL.B4 suggestion_buckets payloads (plans/tickets-weekly-targets-load-risk-2026-06-07.md).
 */
import type { Suggestion } from '../lib/engine';
import type { Activity, ActivityClass } from '../types';
import {
  WTL_F1_PERIOD_END,
  WTL_F1_PERIOD_START,
  completeWeeklyProgress,
  overCompleteWeeklyProgress,
  type WeeklyProgressWtlF1,
} from './wtlF1WeeklyProgressFixtures';

export const WTL_F3_CLASS_FOOT: ActivityClass = {
  id: 'cls-wtl-b3',
  userId: 'user-1',
  name: 'WTL Foot Load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F3_ACTIVITY_WALK: Activity = {
  id: 'act-wtl-walk',
  userId: 'user-1',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  name: 'Morning Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F3_ACTIVITY_BIKE: Activity = {
  id: 'act-wtl-bike',
  userId: 'user-1',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  name: 'Stationary Bike',
  type: 'performance',
  defaultVolumeUnit: 'minutes',
  isActive: true,
  createdAt: '2026-06-01T00:00:00Z',
};

/** Incomplete walk weekly target — Sunday dashboard graph (3.5 km remaining). */
export const wtlF3WalkDoIncomplete: Suggestion = {
  id: WTL_F3_ACTIVITY_WALK.id,
  label: WTL_F3_ACTIVITY_WALK.name,
  state: 'safe',
  reason: '3.5 km left this week',
  bucket: 'do',
  scope: 'activity',
  activityClassId: WTL_F3_CLASS_FOOT.id,
};

/** Incomplete bike weekly target — Sunday dashboard graph (35 minutes remaining). */
export const wtlF3BikeDoIncomplete: Suggestion = {
  id: WTL_F3_ACTIVITY_BIKE.id,
  label: WTL_F3_ACTIVITY_BIKE.name,
  state: 'safe',
  reason: '35 minutes left this week',
  bucket: 'do',
  scope: 'activity',
  activityClassId: WTL_F3_CLASS_FOOT.id,
};

/** Caution-state Do row for ordering checks. */
export const wtlF3BikeDoCaution: Suggestion = {
  ...wtlF3BikeDoIncomplete,
  state: 'caution',
  reason: '35 minutes left this week',
  nextSafeDate: '2026-06-08',
};

/** Walk logged today with incomplete weekly target — Done, not Do. */
export const wtlF3WalkDoneLoggedToday: Suggestion = {
  id: WTL_F3_ACTIVITY_WALK.id,
  label: WTL_F3_ACTIVITY_WALK.name,
  state: 'safe',
  reason: 'Logged today.',
  bucket: 'done',
  scope: 'activity',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  description: 'Logged today.',
};

/**
 * Rest overrides incomplete weekly target — rule reason only, no target pressure copy.
 * Mirrors WTL.B4 rest_between_class on Saturday walk log.
 */
export const WTL_F3_WALK_REST_RULE_REASON =
  'Too soon after the last session in this class.';

export const wtlF3WalkRestOverride: Suggestion = {
  id: WTL_F3_ACTIVITY_WALK.id,
  label: WTL_F3_ACTIVITY_WALK.name,
  state: 'danger',
  reason: WTL_F3_WALK_REST_RULE_REASON,
  bucket: 'rest',
  scope: 'activity',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  description: WTL_F3_WALK_REST_RULE_REASON,
};

/** Only bike remains in Do when walk weekly target is complete (walk absent from all buckets). */
export const wtlF3OnlyBikeDoBuckets: Suggestion[] = [wtlF3BikeDoIncomplete];

/** Both weekly targets met; no logs today — engine returns an empty bucket list. */
export const wtlF3AllTargetsCompleteBuckets: Suggestion[] = [];

export const wtlF3WalkProgressIncomplete: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-walk',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  className: WTL_F3_CLASS_FOOT.name,
  activityId: WTL_F3_ACTIVITY_WALK.id,
  activityName: WTL_F3_ACTIVITY_WALK.name,
  value: 4.5,
  target: 8,
  unit: 'km',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

export const wtlF3BikeProgressIncomplete: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-bike-minutes',
  activityClassId: WTL_F3_CLASS_FOOT.id,
  className: WTL_F3_CLASS_FOOT.name,
  activityId: WTL_F3_ACTIVITY_BIKE.id,
  activityName: WTL_F3_ACTIVITY_BIKE.name,
  value: 25,
  target: 60,
  unit: 'minutes',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

/** Both targets met — calm empty Do copy scenario. */
export const wtlF3AllTargetsCompleteProgress: WeeklyProgressWtlF1[] = [
  {
    ...overCompleteWeeklyProgress,
    weeklyTargetId: 'wt-wtl-walk',
    activityId: WTL_F3_ACTIVITY_WALK.id,
    activityName: WTL_F3_ACTIVITY_WALK.name,
    value: 8,
    target: 8,
    state: 'neutral',
    periodStart: WTL_F1_PERIOD_START,
    periodEnd: WTL_F1_PERIOD_END,
  },
  {
    ...completeWeeklyProgress,
    weeklyTargetId: 'wt-wtl-bike-minutes',
    activityId: WTL_F3_ACTIVITY_BIKE.id,
    activityName: WTL_F3_ACTIVITY_BIKE.name,
    periodStart: WTL_F1_PERIOD_START,
    periodEnd: WTL_F1_PERIOD_END,
  },
];

export const WTL_F3_AS_OF = WTL_F1_PERIOD_END;
