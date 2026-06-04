/**
 * Snake_case API fixtures for mapper/client tests.
 * Field names match backend/app/schemas/* (authoritative contract).
 */

import { LOGS, BLOCK, ACTIVITY_CLASSES, ACTIVITIES, USER_NAME, TODAY } from '../mockData';

const firstLog = LOGS[0];
if (!firstLog) {
  throw new Error('mockData LOGS fixture must include at least one entry');
}

/** ActivityLogRead — backend omits user_id on reads. */
export const activityLogReadSnake = {
  id: firstLog.id,
  activity_id: firstLog.activityId,
  logged_date: firstLog.loggedDate,
  duration_minutes: firstLog.durationMinutes,
  volume_value: firstLog.volumeValue,
  volume_unit: firstLog.volumeUnit ?? null,
  rpe: firstLog.rpe ?? null,
  post_activity_feel: firstLog.postActivityFeel ?? null,
  notes: null as string | null,
  rule_violations_at_log: null as unknown[] | null,
  created_at: firstLog.createdAt,
  updated_at: firstLog.updatedAt ?? firstLog.createdAt,
};

/** CamelCase draft for ActivityLogCreate round-trip (request body). */
export const activityLogCreateDraft = {
  id: 'log-new-1',
  activityId: 'act-walk',
  loggedDate: '2026-05-26' as const,
  durationMinutes: 25,
  volumeValue: 2.0,
  volumeUnit: 'km' as const,
  rpe: 4 as const,
  postActivityFeel: 'fine' as const,
  notes: 'Easy pace',
};

export const activityLogCreateSnakeExpected = {
  id: 'log-new-1',
  activity_id: 'act-walk',
  logged_date: '2026-05-26',
  duration_minutes: 25,
  volume_value: 2.0,
  volume_unit: 'km',
  rpe: 4,
  post_activity_feel: 'fine',
  notes: 'Easy pace',
};

export const ruleViolationReadSnakeCaution = {
  rule_id: 'rule-rest-foot',
  rule_type: 'rest_between_class',
  message: 'Breaks 3-day rest rule for foot load',
  severity: 'caution',
};

export const ruleViolationReadSnakeDanger = {
  rule_id: 'rule-cap-foot',
  rule_type: 'weekly_load_cap',
  message: 'Weekly load cap exceeded',
  severity: 'danger',
};

export const dailyCheckInReadSnakeWithFlareUp = {
  id: 'ci-flare',
  check_in_date: '2026-04-24',
  pain_level: 7,
  readiness_level: 2,
  stiffness_level: 8,
  has_flare_up: true,
  notes: null as string | null,
  created_at: '2026-04-24T07:00:00Z',
  updated_at: '2026-04-24T07:00:00Z',
  flare_up: {
    id: 'inc-embedded-1',
    incident_date: '2026-04-24',
    body_part: 'Left heel',
    severity: 7,
    activity_class_id: 'cls-foot',
    daily_check_in_id: 'ci-flare',
    notes: null as string | null,
  },
};

export const dailyCheckInReadSnakeNoFlareUp = {
  id: 'ci-plain',
  check_in_date: '2026-05-22',
  pain_level: 2,
  readiness_level: 7,
  stiffness_level: 3,
  has_flare_up: false,
  notes: 'Feeling good',
  created_at: '2026-05-22T07:00:00Z',
  updated_at: '2026-05-22T07:00:00Z',
  flare_up: null,
};

export const recoveryStreakReadSnake = {
  recovery_target_id: 'rt-stretch',
  activity_id: 'act-stretch',
  activity_name: 'Light Stretching',
  activity_class_id: 'cls-recovery',
  target_frequency: 2,
  frequency_unit: 'daily',
  current_streak_days: 3,
};

/** Active goal on GET /api/dashboard (B8.1). */
export const dashboardGoalReadSnake = {
  id: 'goal-1',
  title: 'Walk 20km without flare-up',
  description: null as string | null,
  target_date: '2026-05-31',
  timeframe: 'monthly',
  activity_class_id: null as string | null,
  progress_value: null as number | null,
  progress_target: null as number | null,
  progress_unit: null as string | null,
  status: 'active',
  created_at: '2026-04-07T06:00:00Z',
  updated_at: '2026-04-07T06:00:00Z',
};

/** Completed block in dashboard previous_blocks (B9.1) — active block omitted server-side. */
export const dashboardPreviousBlockReadSnake = {
  id: 'blk-0',
  name: 'Phase 1 Foundation',
  start_date: '2026-03-01',
  end_date: '2026-04-06',
  status: 'completed',
  related_goal_id: null as string | null,
  notes: null as string | null,
  is_review_milestone_hit: true,
  created_at: '2026-03-01T06:00:00Z',
  updated_at: '2026-03-01T06:00:00Z',
};

/** Minimal dashboard payload exercising top-level keys and edge cases. */
export const dashboardReadSnake = {
  as_of: TODAY,
  user_name: USER_NAME,
  block: {
    id: BLOCK.id,
    name: BLOCK.name,
    start_date: BLOCK.startDate,
    end_date: BLOCK.endDate ?? null,
    status: BLOCK.status,
    related_goal_id: null as string | null,
    notes: null as string | null,
    is_review_milestone_hit: BLOCK.isReviewMilestoneHit,
    created_at: BLOCK.createdAt,
    updated_at: BLOCK.updatedAt ?? BLOCK.createdAt,
  },
  activity_classes: ACTIVITY_CLASSES.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    type: c.type,
    default_recovery_window_days: c.defaultRecoveryWindowDays,
    created_at: c.createdAt,
    updated_at: c.updatedAt ?? c.createdAt,
  })),
  activities: ACTIVITIES.map((a) => ({
    id: a.id,
    activity_class_id: a.activityClassId,
    name: a.name,
    type: a.type,
    default_volume_unit: a.defaultVolumeUnit ?? null,
    is_active: a.isActive,
    created_at: a.createdAt,
    updated_at: a.updatedAt ?? a.createdAt,
  })),
  logs: [activityLogReadSnake],
  incidents: [] as unknown[],
  has_checked_in_today: false,
  class_statuses: [] as unknown[],
  suggestions: [] as unknown[],
  weekly_progress: [] as unknown[],
  daily_scores: [
    {
      date: TODAY,
      state: 'neutral',
      violations: [],
      had_flare_up: false,
      pain_level: null as number | null,
    },
  ],
  load_series: [] as unknown[],
  flare_up_dates: [] as string[],
  week_load_threshold: 120,
  clean_streak: 2,
  recovery_streaks: [recoveryStreakReadSnake],
  goals: [dashboardGoalReadSnake],
  previous_blocks: [dashboardPreviousBlockReadSnake],
};

export const dashboardReadSnakeNoBlock = {
  ...dashboardReadSnake,
  block: null,
  activity_classes: [],
  activities: [],
  logs: [],
  recovery_streaks: [],
};

export const fastApiDetailErrorBody = JSON.stringify({
  detail: 'Activity not found',
});

export const fastApiValidationErrorBody = JSON.stringify({
  detail: [{ loc: ['body', 'volume_value'], msg: 'Field required', type: 'missing' }],
});
