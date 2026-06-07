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
  goalDashboardRowAchievedSnake,
  goalDashboardRowNumericSnake,
  goalDashboardRowQualitativeSnake,
  recoveryStreakReadSnake,
  fastApiDetailErrorBody,
  fastApiValidationErrorBody,
} from './testFixtures';
import { parseApiError } from './client';
import {
  buildQuery,
  mapActivityLogFromApi,
  mapActivityLogCreateBody,
  mapActivityLogPatchBody,
  mapCheckViolationsRequestBody,
  mapCheckViolationsResponseFromApi,
  mapDailyCheckInCreateBody,
  mapDailyCheckInFromApi,
  mapDashboardFromApi,
  mapDelayedTaxResponseFromApi,
  mapFlareUpIncidentFromApi,
  mapLoadSummaryFromApi,
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
    expect(mapped.suggestionBuckets).toEqual([]);
    expect(mapped.loadRiskSummary).toBeNull();
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

  it('maps suggestion_buckets and load_risk_summary from dashboard payload', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      suggestion_buckets: [
        {
          id: 'act-walk',
          label: 'Walking',
          state: 'safe',
          reason: 'Ready',
          bucket: 'do',
          scope: 'activity',
          activity_class_id: 'cls-foot',
          description: null,
        },
      ],
      load_risk_summary: {
        week_days: [{ date: '2026-05-28', flagged: true }],
        class_bars: [
          {
            activity_class_id: 'cls-foot',
            class_name: 'Foot load',
            actual: 4,
            limit: 10,
            unit: 'km',
            exercises: [],
          },
        ],
      },
    });

    expect(mapped.suggestionBuckets[0]).toMatchObject({
      id: 'act-walk',
      bucket: 'do',
      scope: 'activity',
    });
    expect(mapped.loadRiskSummary?.weekDays).toHaveLength(1);
    expect(mapped.loadRiskSummary?.classBars[0]?.className).toBe('Foot load');
  });

  it('maps block null to null (not undefined)', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnakeNoBlock);

    expect(mapped.block).toBeNull();
    expect(mapped.graphClassId).toBeNull();
    expect(mapped.recoveryStreaks).toEqual([]);
    expect(mapped.activityClasses).toEqual([]);
    expect(mapped.goals).toHaveLength(dashboardReadSnakeNoBlock.goals.length);
    expect(mapped.previousBlocks).toHaveLength(dashboardReadSnakeNoBlock.previous_blocks.length);
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

  it('maps goal_rows to camelCase goalRows with fillRatio and isQualitative', () => {
    const mapped = mapDashboardFromApi(dashboardReadSnake) as ReturnType<
      typeof mapDashboardFromApi
    > & {
      goalRows: Array<{
        goalId: string;
        title: string;
        status: string;
        activityId: string | null;
        progressValue: number | null;
        progressTarget: number | null;
        progressUnit: string | null;
        fillRatio: number | null;
        isQualitative: boolean;
      }>;
    };

    expect(mapped.goalRows).toEqual([
      {
        goalId: goalDashboardRowNumericSnake.goal_id,
        title: goalDashboardRowNumericSnake.title,
        status: goalDashboardRowNumericSnake.status,
        activityId: goalDashboardRowNumericSnake.activity_id,
        progressValue: goalDashboardRowNumericSnake.progress_value,
        progressTarget: goalDashboardRowNumericSnake.progress_target,
        progressUnit: goalDashboardRowNumericSnake.progress_unit,
        fillRatio: goalDashboardRowNumericSnake.fill_ratio,
        isQualitative: goalDashboardRowNumericSnake.is_qualitative,
      },
      {
        goalId: goalDashboardRowQualitativeSnake.goal_id,
        title: goalDashboardRowQualitativeSnake.title,
        status: goalDashboardRowQualitativeSnake.status,
        activityId: goalDashboardRowQualitativeSnake.activity_id,
        progressValue: goalDashboardRowQualitativeSnake.progress_value,
        progressTarget: goalDashboardRowQualitativeSnake.progress_target,
        progressUnit: goalDashboardRowQualitativeSnake.progress_unit,
        fillRatio: goalDashboardRowQualitativeSnake.fill_ratio,
        isQualitative: goalDashboardRowQualitativeSnake.is_qualitative,
      },
      {
        goalId: goalDashboardRowAchievedSnake.goal_id,
        title: goalDashboardRowAchievedSnake.title,
        status: goalDashboardRowAchievedSnake.status,
        activityId: goalDashboardRowAchievedSnake.activity_id,
        progressValue: goalDashboardRowAchievedSnake.progress_value,
        progressTarget: goalDashboardRowAchievedSnake.progress_target,
        progressUnit: goalDashboardRowAchievedSnake.progress_unit,
        fillRatio: goalDashboardRowAchievedSnake.fill_ratio,
        isQualitative: goalDashboardRowAchievedSnake.is_qualitative,
      },
    ]);
  });

  it('maps missing goal_rows to an empty array', () => {
    const { goal_rows, ...withoutGoalRows } = dashboardReadSnake;
    void goal_rows;
    const mapped = mapDashboardFromApi(withoutGoalRows) as ReturnType<
      typeof mapDashboardFromApi
    > & { goalRows: unknown[] };

    expect(mapped.goalRows).toEqual([]);
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

describe('mapCheckViolationsRequestBody', () => {
  it('maps camelCase input to snake_case POST body', () => {
    expect(
      mapCheckViolationsRequestBody({
        activityId: 'act-walk',
        volumeValue: 2.5,
        rpe: 5,
        asOf: '2026-05-25',
      }),
    ).toEqual({
      activity_id: 'act-walk',
      volume_value: 2.5,
      rpe: 5,
      as_of: '2026-05-25',
    });
  });

  it('omits as_of when not provided', () => {
    const body = mapCheckViolationsRequestBody({
      activityId: 'act-walk',
      volumeValue: 2.5,
      rpe: 5,
    });

    expect(body).not.toHaveProperty('as_of');
  });
});

describe('mapCheckViolationsResponseFromApi', () => {
  it('maps violations array from snake_case', () => {
    const mapped = mapCheckViolationsResponseFromApi({
      violations: [ruleViolationReadSnakeCaution],
    });

    expect(mapped.violations).toEqual([
      {
        ruleId: 'rule-rest-foot',
        ruleType: 'rest_between_class',
        message: 'Breaks 3-day rest rule for foot load',
        severity: 'caution',
      },
    ]);
  });

  it('returns empty violations when response violations is not an array', () => {
    expect(mapCheckViolationsResponseFromApi({ violations: null }).violations).toEqual([]);
  });
});

describe('mapLoadSummaryFromApi', () => {
  it('maps class_statuses, suggestions, and weekly_progress lists', () => {
    const mapped = mapLoadSummaryFromApi({
      as_of: '2026-05-25',
      class_statuses: [
        {
          activity_class_id: 'cls-foot',
          state: 'caution',
          label: 'Foot load',
          reason: 'Approaching cap',
        },
      ],
      suggestions: [
        {
          id: 'sug-1',
          label: 'Rest foot class',
          state: 'caution',
          reason: 'Cap near limit',
        },
      ],
      weekly_progress: [
        {
          weekly_target_id: 'wt-foot',
          activity_class_id: 'cls-foot',
          class_name: 'Foot load',
          value: 80,
          target: 120,
          unit: 'load',
          state: 'caution',
        },
      ],
    });

    expect(mapped.asOf).toBe('2026-05-25');
    expect(mapped.classStatuses[0]).toMatchObject({
      activityClassId: 'cls-foot',
      state: 'caution',
      label: 'Foot load',
    });
    expect(mapped.suggestions[0]?.id).toBe('sug-1');
    expect(mapped.weeklyProgress[0]?.className).toBe('Foot load');
  });
});

describe('mapDelayedTaxResponseFromApi', () => {
  it('maps hits with snake_case keys converted to camelCase', () => {
    const mapped = mapDelayedTaxResponseFromApi({
      as_of: '2026-05-25',
      risk_window_days: 7,
      baseline_days: 14,
      pain_threshold: 3,
      hits: [{ activity_id: 'act-walk', risk_score: 0.8 }],
    });

    expect(mapped).toMatchObject({
      asOf: '2026-05-25',
      riskWindowDays: 7,
      baselineDays: 14,
      painThreshold: 3,
    });
    expect(mapped.hits[0]).toMatchObject({ activityId: 'act-walk', riskScore: 0.8 });
  });
});

describe('mapActivityLogPatchBody', () => {
  it('maps only provided camelCase keys to snake_case', () => {
    expect(
      mapActivityLogPatchBody({
        durationMinutes: 30,
        notes: 'Updated',
        unusedField: undefined,
      }),
    ).toEqual({
      duration_minutes: 30,
      notes: 'Updated',
    });
  });
});

describe('mapFlareUpIncidentFromApi', () => {
  it('maps snake_case incident read shape without userId', () => {
    const mapped = mapFlareUpIncidentFromApi({
      id: 'inc-1',
      incident_date: '2026-05-25',
      body_part: 'Left heel',
      severity: 7,
      activity_class_id: 'cls-foot',
      daily_check_in_id: null,
      notes: 'Sharp pain',
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    });

    expect(mapped).toMatchObject({
      id: 'inc-1',
      incidentDate: '2026-05-25',
      bodyPart: 'Left heel',
      severity: 7,
      activityClassId: 'cls-foot',
      notes: 'Sharp pain',
    });
    expect('userId' in mapped).toBe(false);
  });
});

describe('buildQuery', () => {
  it('builds query string omitting undefined params', () => {
    expect(
      buildQuery({
        from: '2026-05-01',
        to: undefined,
        activity_id: 'act-walk',
      }),
    ).toBe('?from=2026-05-01&activity_id=act-walk');
  });

  it('returns empty string when no params provided', () => {
    expect(buildQuery({})).toBe('');
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
