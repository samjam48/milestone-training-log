/**
 * WTL.F7 — shared weekly focus fixtures for Settings and hook tests.
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F7
 */

import type { Rule, TrainingBlock } from '../types';

export type WeeklyFocusBlock = TrainingBlock & {
  periodKind: 'weekly_focus' | 'legacy';
  focusSeriesId: string;
  focusTitle: string;
  weekNumber: number;
};

export const WTL_F7_FOCUS_TITLE = 'Return to walking';

export const WTL_F7_ACTIVE_WEEKLY_FOCUS: WeeklyFocusBlock = {
  id: 'blk-wf-active',
  userId: 'user-1',
  name: `${WTL_F7_FOCUS_TITLE} · Week 3`,
  startDate: '2026-06-02',
  endDate: '2026-06-08',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-02T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: WTL_F7_FOCUS_TITLE,
  weekNumber: 3,
};

export const WTL_F7_PREVIOUS_WEEK_2: WeeklyFocusBlock = {
  id: 'blk-wf-week-2',
  userId: 'user-1',
  name: `${WTL_F7_FOCUS_TITLE} · Week 2`,
  startDate: '2026-05-26',
  endDate: '2026-06-01',
  status: 'completed',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-26T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: WTL_F7_FOCUS_TITLE,
  weekNumber: 2,
};

export const WTL_F7_PREVIOUS_WEEK_1: WeeklyFocusBlock = {
  id: 'blk-wf-week-1',
  userId: 'user-1',
  name: `${WTL_F7_FOCUS_TITLE} · Week 1`,
  startDate: '2026-05-19',
  endDate: '2026-05-25',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-05-19T00:00:00Z',
  periodKind: 'weekly_focus',
  focusSeriesId: 'fs-active',
  focusTitle: WTL_F7_FOCUS_TITLE,
  weekNumber: 1,
};

export const WTL_F7_RESET_FOCUS_BLOCK: WeeklyFocusBlock = {
  ...WTL_F7_ACTIVE_WEEKLY_FOCUS,
  id: 'blk-wf-reset',
  name: 'Build running base · Week 1',
  focusSeriesId: 'fs-reset',
  focusTitle: 'Build running base',
  weekNumber: 1,
  startDate: '2026-06-02',
  endDate: '2026-06-08',
};

export const WTL_F7_RULE_REST: Rule = {
  id: 'rule-wf-rest',
  trainingBlockId: WTL_F7_ACTIVE_WEEKLY_FOCUS.id,
  activityClassId: 'cls-foot',
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-02T00:00:00Z',
};

export const WTL_F7_NO_ACTIVE_BLOCK: TrainingBlock = {
  id: '',
  userId: 'user-1',
  name: '',
  startDate: '1970-01-01',
  endDate: '1970-01-01',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '1970-01-01T00:00:00Z',
};

export function weeklyFocusBlockSnake(block: WeeklyFocusBlock): Record<string, unknown> {
  return {
    id: block.id,
    user_id: block.userId,
    name: block.name,
    start_date: block.startDate,
    end_date: block.endDate ?? null,
    status: block.status,
    is_review_milestone_hit: block.isReviewMilestoneHit,
    created_at: block.createdAt,
    period_kind: block.periodKind,
    focus_series_id: block.focusSeriesId,
    focus_title: block.focusTitle,
    week_number: block.weekNumber,
  };
}
