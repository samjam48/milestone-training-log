/**
 * S25.F2 — Goal dashboard row fixtures for GoalsCard and mapper tests.
 * Shape mirrors backend GoalDashboardRowRead until types/mappers land.
 */

import type { GoalStatus } from '../types';

export interface GoalDashboardRow {
  goalId: string;
  title: string;
  status: GoalStatus;
  activityId: string | null;
  progressValue: number | null;
  progressTarget: number | null;
  progressUnit: string | null;
  fillRatio: number | null;
  isQualitative: boolean;
}

export const goalDashboardRowNumeric: GoalDashboardRow = {
  goalId: 'goal-row-active',
  title: 'Walk 40 km',
  status: 'active',
  activityId: 'act-walk',
  progressValue: 12,
  progressTarget: 30,
  progressUnit: 'km',
  fillRatio: 0.4,
  isQualitative: false,
};

export const goalDashboardRowQualitative: GoalDashboardRow = {
  goalId: 'goal-row-qual',
  title: 'Pain-free stairs',
  status: 'active',
  activityId: null,
  progressValue: null,
  progressTarget: null,
  progressUnit: null,
  fillRatio: null,
  isQualitative: true,
};

export const goalDashboardRowAchieved: GoalDashboardRow = {
  goalId: 'goal-row-achieved',
  title: 'Complete rehab block',
  status: 'achieved',
  activityId: 'act-walk',
  progressValue: 30,
  progressTarget: 30,
  progressUnit: 'km',
  fillRatio: 1,
  isQualitative: false,
};

export const goalDashboardRowPausedQualitative: GoalDashboardRow = {
  goalId: 'goal-row-paused',
  title: 'Cycle 100k',
  status: 'paused',
  activityId: null,
  progressValue: null,
  progressTarget: null,
  progressUnit: null,
  fillRatio: null,
  isQualitative: true,
};
