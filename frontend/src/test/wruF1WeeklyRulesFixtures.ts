/**
 * WRU.F1 — shared weekly rules fixtures for Settings tests.
 * plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F1
 */

import type { Rule, TrainingBlock } from '../types';

export type WeeklyRulesBlock = TrainingBlock & {
  periodKind: 'weekly_focus';
  focusSeriesId: string;
  focusTitle: string;
  weekNumber: number;
};

/** Matches Settings calendar week primary label (Mon–Sun, no year). */
export function formatCalendarWeekRange(startDate: string, endDate?: string): string {
  const resolvedEnd = endDate ?? startDate;
  const formatShort = (iso: string): string =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${formatShort(startDate)} – ${formatShort(resolvedEnd)}`;
}

export const WRU_F1_ACTIVE_WEEK: WeeklyRulesBlock = {
  id: 'blk-wru-active',
  userId: 'user-1',
  name: 'Jun 2 – Jun 8, 2026',
  startDate: '2026-06-02',
  endDate: '2026-06-08',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-02T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: 'Return to walking',
  weekNumber: 3,
};

export const WRU_F1_PREVIOUS_WEEK_2: WeeklyRulesBlock = {
  id: 'blk-wru-week-2',
  userId: 'user-1',
  name: 'May 26 – Jun 1, 2026',
  startDate: '2026-05-26',
  endDate: '2026-06-01',
  status: 'completed',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-26T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: 'Return to walking',
  weekNumber: 2,
};

export const WRU_F1_PREVIOUS_WEEK_1: WeeklyRulesBlock = {
  id: 'blk-wru-week-1',
  userId: 'user-1',
  name: 'May 19 – May 25, 2026',
  startDate: '2026-05-19',
  endDate: '2026-05-25',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-05-19T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: 'Return to walking',
  weekNumber: 1,
};

export const WRU_F1_RULE_REST: Rule = {
  id: 'rule-wru-rest',
  trainingBlockId: WRU_F1_ACTIVE_WEEK.id,
  activityClassId: 'cls-foot',
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-02T00:00:00Z',
};

export const WRU_F1_ACTIVE_WEEK_LABEL = formatCalendarWeekRange(
  WRU_F1_ACTIVE_WEEK.startDate,
  WRU_F1_ACTIVE_WEEK.endDate,
);

export const WRU_F1_PREVIOUS_WEEK_2_LABEL = formatCalendarWeekRange(
  WRU_F1_PREVIOUS_WEEK_2.startDate,
  WRU_F1_PREVIOUS_WEEK_2.endDate,
);

export const WRU_F1_PREVIOUS_WEEK_1_LABEL = formatCalendarWeekRange(
  WRU_F1_PREVIOUS_WEEK_1.startDate,
  WRU_F1_PREVIOUS_WEEK_1.endDate,
);
