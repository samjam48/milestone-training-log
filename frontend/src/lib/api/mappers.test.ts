/**
 * F1.2 — snake↔camel mapper unit tests (written before implementation).
 */
import { describe, it, expect } from 'vitest';
import type { DailyCheckIn, RuleViolationSnapshot } from '../../types';
import {
  activityLogReadSnake,
  activityLogCreateDraft,
  activityLogCreateSnakeExpected,
  ruleViolationReadSnakeCaution,
  ruleViolationReadSnakeDanger,
  dailyCheckInReadSnakeWithFlareUp,
  dailyCheckInReadSnakeNoFlareUp,
  dashboardReadSnake,
  dashboardReadSnakeNoBlock,
  recoveryStreakReadSnake,
  fastApiDetailErrorBody,
  fastApiValidationErrorBody,
} from './testFixtures';
import { parseApiError } from './client';
import {
  mapActivityLogFromApi,
  mapActivityLogCreateBody,
  mapDailyCheckInCreateBody,
  mapDailyCheckInFromApi,
  mapDashboardFromApi,
  mapRuleViolationFromApi,
} from './mappers';

describe('mapActivityLogFromApi', () => {
  it('maps snake_case ActivityLogRead to camelCase ActivityLog without userId', () => {
    const mapped = mapActivityLogFromApi(activityLogReadSnake);

    expect(mapped).toMatchObject({
      id: activityLogReadSnake.id,
      activityId: activityLogReadSnake.activity_id,
      loggedDate: activityLogReadSnake.logged_date,
      durationMinutes: activityLogReadSnake.duration_minutes,
      volumeValue: activityLogReadSnake.volume_value,
      volumeUnit: activityLogReadSnake.volume_unit,
      rpe: activityLogReadSnake.rpe,
      postActivityFeel: activityLogReadSnake.post_activity_feel,
      notes: null,
      ruleViolationsAtLog: null,
      createdAt: activityLogReadSnake.created_at,
      updatedAt: activityLogReadSnake.updated_at,
    });

    expect('userId' in mapped).toBe(false);
  });

  it('preserves null for optional nullable fields', () => {
    const mapped = mapActivityLogFromApi({
      ...activityLogReadSnake,
      volume_unit: null,
      rpe: null,
      notes: null,
    });

    expect(mapped.volumeUnit).toBeNull();
    expect(mapped.rpe).toBeNull();
    expect(mapped.notes).toBeNull();
  });

  it('maps nested rule_violations_at_log to camelCase snapshots', () => {
    const mapped = mapActivityLogFromApi({
      ...activityLogReadSnake,
      rule_violations_at_log: [ruleViolationReadSnakeCaution],
    });

    expect(mapped.ruleViolationsAtLog).toEqual([
      {
        ruleId: 'rule-rest-foot',
        ruleType: 'rest_between_class',
        message: 'Breaks 3-day rest rule for foot load',
        severity: 'caution',
      },
    ] satisfies RuleViolationSnapshot[]);
  });
});

describe('mapActivityLogCreateBody', () => {
  it('maps camelCase create draft to snake_case POST body', () => {
    const body = mapActivityLogCreateBody(activityLogCreateDraft);

    expect(body).toEqual(activityLogCreateSnakeExpected);
    expect(body).not.toHaveProperty('activityId');
    expect(body).not.toHaveProperty('loggedDate');
  });

  it('round-trips create body keys through response mapper shape', () => {
    const body = mapActivityLogCreateBody(activityLogCreateDraft);
    const readShape = {
      ...body,
      created_at: '2026-05-26T08:00:00Z',
      updated_at: '2026-05-26T08:00:00Z',
      rule_violations_at_log: null,
    };
    const mapped = mapActivityLogFromApi(readShape);

    expect(mapped.activityId).toBe(activityLogCreateDraft.activityId);
    expect(mapped.loggedDate).toBe(activityLogCreateDraft.loggedDate);
    expect(mapped.durationMinutes).toBe(activityLogCreateDraft.durationMinutes);
    expect(mapped.volumeValue).toBe(activityLogCreateDraft.volumeValue);
  });
});

describe('mapDashboardFromApi', () => {
  it('maps all top-level keys including recovery_streaks', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnake);

    expect(mapped.todayDate).toBe(dashboardReadSnake.as_of);
    expect(mapped.userName).toBe(dashboardReadSnake.user_name);
    expect(mapped.block).toMatchObject({
      id: dashboardReadSnake.block!.id,
      name: dashboardReadSnake.block!.name,
      startDate: dashboardReadSnake.block!.start_date,
    });
    expect(mapped.activityClasses).toHaveLength(dashboardReadSnake.activity_classes.length);
    expect(mapped.activities).toHaveLength(dashboardReadSnake.activities.length);
    expect(mapped.logs).toHaveLength(1);
    expect(mapped.incidents).toEqual([]);
    expect(mapped.hasCheckedInToday).toBe(false);
    expect(mapped.classStatuses).toEqual([]);
    expect(mapped.suggestions).toEqual([]);
    expect(mapped.weeklyProgress).toEqual([]);
    expect(mapped.dailyScores).toHaveLength(1);
    expect(mapped.loadSeries).toEqual([]);
    expect(mapped.flareUpDates).toEqual([]);
    expect(mapped.weekLoadThreshold).toBe(120);
    expect(mapped.cleanStreak).toBe(2);
    expect(mapped.recoveryStreaks).toEqual([
      {
        recoveryTargetId: recoveryStreakReadSnake.recovery_target_id,
        activityId: recoveryStreakReadSnake.activity_id,
        activityName: recoveryStreakReadSnake.activity_name,
        activityClassId: recoveryStreakReadSnake.activity_class_id,
        targetFrequency: recoveryStreakReadSnake.target_frequency,
        frequencyUnit: recoveryStreakReadSnake.frequency_unit,
        currentStreakDays: recoveryStreakReadSnake.current_streak_days,
      },
    ]);
  });

  it('maps block null to null (not undefined)', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnakeNoBlock);

    expect(mapped.block).toBeNull();
    expect(mapped.recoveryStreaks).toEqual([]);
    expect(mapped.activityClasses).toEqual([]);
  });

  it('maps daily_scores state neutral to SafetyState | neutral', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnake);

    expect(mapped.dailyScores[0]?.state).toBe('neutral');
  });

  it('passes YYYY-MM-DD dates through unchanged', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnake);

    expect(mapped.todayDate).toBe('2026-05-25');
    expect(mapped.dailyScores[0]?.date).toBe('2026-05-25');
  });
});

describe('mapDailyCheckInFromApi', () => {
  it('maps embedded flare_up to flareUp with likelyCauseActivityClassIds array', () => {
    const mapped = mapDailyCheckInFromApi(dailyCheckInReadSnakeWithFlareUp);

    expect(mapped.hasFlareUp).toBe(true);
    expect(mapped.flareUp).toEqual({
      bodyPart: 'Left heel',
      severity: 7,
      likelyCauseActivityClassIds: ['cls-foot'],
    });
    expect(mapped.checkInDate).toBe('2026-04-24');
    expect('userId' in mapped).toBe(false);
  });

  it('maps flare_up with null activity_class_id to empty likelyCauseActivityClassIds', () => {
    const mapped = mapDailyCheckInFromApi({
      ...dailyCheckInReadSnakeWithFlareUp,
      flare_up: {
        ...dailyCheckInReadSnakeWithFlareUp.flare_up!,
        activity_class_id: null,
      },
    });

    expect(mapped.flareUp?.likelyCauseActivityClassIds).toEqual([]);
  });

  it('maps check-in without flare_up', () => {
    const mapped = mapDailyCheckInFromApi(dailyCheckInReadSnakeNoFlareUp);

    expect(mapped).toMatchObject({
      id: 'ci-plain',
      checkInDate: '2026-05-22',
      painLevel: 2,
      readinessLevel: 7,
      stiffnessLevel: 3,
      hasFlareUp: false,
      notes: 'Feeling good',
    } satisfies Partial<DailyCheckIn>);

    expect(mapped.flareUp).toBeUndefined();
  });

  it('preserves null notes', () => {
    const mapped = mapDailyCheckInFromApi(dailyCheckInReadSnakeWithFlareUp);

    expect(mapped.notes).toBeNull();
  });
});

describe('mapDailyCheckInCreateBody', () => {
  it('maps nested flareUp to FlareUpForCheckInCreate snake_case shape', () => {
    const body = mapDailyCheckInCreateBody({
      id: 'ci-new',
      checkInDate: '2026-05-28',
      painLevel: 6,
      readinessLevel: 4,
      stiffnessLevel: 5,
      hasFlareUp: true,
      flareUp: {
        id: 'inc-new-1',
        bodyPart: 'Left heel',
        severity: 7,
        likelyCauseActivityClassIds: ['cls-foot', 'cls-other'],
      },
    });

    expect(body).toMatchObject({
      id: 'ci-new',
      check_in_date: '2026-05-28',
      pain_level: 6,
      readiness_level: 4,
      stiffness_level: 5,
      has_flare_up: true,
      flare_up: {
        id: 'inc-new-1',
        body_part: 'Left heel',
        severity: 7,
        activity_class_id: 'cls-foot',
      },
    });
    expect(body.flare_up).not.toHaveProperty('likely_cause_activity_class_ids');
    expect(body.flare_up).not.toHaveProperty('likelyCauseActivityClassIds');
  });

  it('omits activity_class_id when likelyCauseActivityClassIds is empty', () => {
    const body = mapDailyCheckInCreateBody({
      id: 'ci-new',
      checkInDate: '2026-05-28',
      painLevel: 6,
      readinessLevel: 4,
      stiffnessLevel: 5,
      hasFlareUp: true,
      flareUp: {
        id: 'inc-new-1',
        bodyPart: 'Left heel',
        severity: 7,
        likelyCauseActivityClassIds: [],
      },
    });

    expect(body.flare_up).toEqual({
      id: 'inc-new-1',
      body_part: 'Left heel',
      severity: 7,
    });
    expect(body.flare_up).not.toHaveProperty('activity_class_id');
  });
});

describe('mapRuleViolationFromApi', () => {
  it('maps caution severity', () => {
    const mapped = mapRuleViolationFromApi(ruleViolationReadSnakeCaution);

    expect(mapped.severity).toBe('caution');
    expect(mapped.ruleId).toBe('rule-rest-foot');
    expect(mapped.ruleType).toBe('rest_between_class');
    expect(mapped.message).toBe('Breaks 3-day rest rule for foot load');
  });

  it('maps danger severity', () => {
    const mapped = mapRuleViolationFromApi(ruleViolationReadSnakeDanger);

    expect(mapped.severity).toBe('danger');
  });
});

describe('parseApiError', () => {
  it('parses FastAPI detail string into ApiError', () => {
    const error = parseApiError(404, fastApiDetailErrorBody);

    expect(error.status).toBe(404);
    expect(error.message).toBe('Activity not found');
    expect(error.detail).toBe('Activity not found');
    expect(error.name).toBe('ApiError');
  });

  it('parses FastAPI validation detail array', () => {
    const error = parseApiError(422, fastApiValidationErrorBody);

    expect(error.status).toBe(422);
    expect(Array.isArray(error.detail)).toBe(true);
    expect(error.message).toContain('volume_value');
  });

  it('uses fallback message when error body is invalid JSON', () => {
    const error = parseApiError(500, 'not json');

    expect(error.status).toBe(500);
    expect(error.message).toBeTruthy();
    expect(error.message).not.toBe('');
    expect(error.detail).toBeUndefined();
  });
});
