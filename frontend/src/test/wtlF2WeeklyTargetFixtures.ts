/**
 * WTL.F2 — Goals screen weekly target flow test fixtures.
 * Aligns with WTL.B2 activity-scoped weekly targets and WTL.B3 This Week progress.
 */
import type { WeeklyProgress } from '../lib/engine';
import type { Activity, ActivityClass, ISODate, TrainingBlock, WeeklyTarget } from '../types';
import {
  WTL_F1_PERIOD_END,
  WTL_F1_PERIOD_START,
  type WeeklyProgressWtlF1,
} from './wtlF1WeeklyProgressFixtures';

export const WTL_F2_BLOCK: TrainingBlock = {
  id: 'blk-wtl-f2',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F2_CLASS_FOOT: ActivityClass = {
  id: 'cls-wtl-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F2_CLASS_MOBILITY: ActivityClass = {
  id: 'cls-wtl-mobility',
  userId: 'user-1',
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  loadWeight: 1,
  createdAt: '2026-06-01T00:00:00Z',
};

/** Performance activity with default volume unit (km). */
export const WTL_F2_ACTIVITY_WALK: Activity = {
  id: 'act-wtl-walk',
  userId: 'user-1',
  activityClassId: WTL_F2_CLASS_FOOT.id,
  name: 'Morning Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-06-01T00:00:00Z',
};

/** Recovery activity with no default volume unit. */
export const WTL_F2_ACTIVITY_STRETCH: Activity = {
  id: 'act-wtl-stretch',
  userId: 'user-1',
  activityClassId: WTL_F2_CLASS_MOBILITY.id,
  name: 'Stretching',
  type: 'recovery',
  isActive: true,
  createdAt: '2026-06-01T00:00:00Z',
};

/** Activity-scoped weekly target shape expected after WTL.B1/B2. */
export type WeeklyTargetWtlF2 = WeeklyTarget & {
  activityId: string;
  activityName?: string;
};

export const WTL_F2_WEEKLY_TARGET_WALK: WeeklyTargetWtlF2 = {
  id: 'wt-wtl-walk',
  trainingBlockId: WTL_F2_BLOCK.id,
  activityClassId: WTL_F2_CLASS_FOOT.id,
  activityId: WTL_F2_ACTIVITY_WALK.id,
  activityName: WTL_F2_ACTIVITY_WALK.name,
  targetValue: 8,
  targetUnit: 'km',
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F2_WEEKLY_TARGET_STRETCH: WeeklyTargetWtlF2 = {
  id: 'wt-wtl-stretch',
  trainingBlockId: WTL_F2_BLOCK.id,
  activityClassId: WTL_F2_CLASS_MOBILITY.id,
  activityId: WTL_F2_ACTIVITY_STRETCH.id,
  activityName: WTL_F2_ACTIVITY_STRETCH.name,
  targetValue: 4,
  targetUnit: 'sessions',
  createdAt: '2026-06-01T00:00:00Z',
};

export const WTL_F2_WALK_PROGRESS: WeeklyProgressWtlF1 = {
  weeklyTargetId: WTL_F2_WEEKLY_TARGET_WALK.id,
  activityClassId: WTL_F2_CLASS_FOOT.id,
  className: WTL_F2_CLASS_FOOT.name,
  activityId: WTL_F2_ACTIVITY_WALK.id,
  activityName: WTL_F2_ACTIVITY_WALK.name,
  value: 4.5,
  target: 8,
  unit: 'km',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START as ISODate,
  periodEnd: WTL_F1_PERIOD_END as ISODate,
};

export const WTL_F2_STRETCH_PROGRESS: WeeklyProgressWtlF1 = {
  weeklyTargetId: WTL_F2_WEEKLY_TARGET_STRETCH.id,
  activityClassId: WTL_F2_CLASS_MOBILITY.id,
  className: WTL_F2_CLASS_MOBILITY.name,
  activityId: WTL_F2_ACTIVITY_STRETCH.id,
  activityName: WTL_F2_ACTIVITY_STRETCH.name,
  value: 2,
  target: 4,
  unit: 'sessions',
  state: 'caution',
  periodStart: WTL_F1_PERIOD_START as ISODate,
  periodEnd: WTL_F1_PERIOD_END as ISODate,
};

export const WTL_F2_WEEKLY_PROGRESS: WeeklyProgress[] = [
  WTL_F2_WALK_PROGRESS,
  WTL_F2_STRETCH_PROGRESS,
];

export const WTL_F2_DUPLICATE_TARGET_ERROR =
  'Weekly target already exists for this activity';
