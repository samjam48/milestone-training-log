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
import {
  weeklyProgressActivityScopedSnake,
  weeklyProgressLegacyClassSnake,
  WTL_F1_PERIOD_END,
  WTL_F1_PERIOD_START,
} from '../../test/wtlF1WeeklyProgressFixtures';
import {
  WTL_F4_AS_OF,
  WTL_F4_GRAPH_START,
  WTL_F4_GRAPH_WINDOW_DAYS,
  wtlF4LoadSeriesSnake,
} from '../../test/wtlF4LoadGraphFixtures';
import {
  wtlF5BikeDailyVolumeRow,
  wtlF5ClassFrequencyRow,
  wtlF5ClassRestRow,
  wtlF5EmptySummarySnake,
  wtlF5FootLoadSummarySnake,
  wtlF5WalkWeeklyVolumeRow,
  wtlF5WeekDays,
  type LoadRiskSummaryWtlF5,
} from '../../test/wtlF5LoadRiskFixtures';
import type { LoadRiskSummary } from '../engine';
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
  mapLoadRiskSummaryFromApi,
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
        week_days: [{ date: '2026-05-28', flagged: true, state: 'caution' }],
        rule_limit_rows: [
          {
            id: 'row-foot-km',
            scope: 'class',
            rule_id: 'rule-foot-km',
            rule_type: 'weekly_volume_cap',
            activity_class_id: 'cls-foot',
            class_name: 'Foot load',
            actual: 4,
            limit: 10,
            unit: 'km',
            state: 'safe',
            label: 'Foot load weekly volume',
            display_mode: 'bar',
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
    expect(mapped.loadRiskSummary?.ruleLimitRows[0]?.className).toBe('Foot load');
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

  it('maps nested ruleViolationsAtLog entries to snake_case rule violation fields', () => {
    expect(
      mapActivityLogPatchBody({
        ruleViolationsAtLog: [
          {
            ruleId: 'rule-rest-foot',
            ruleType: 'rest_between_class',
            message: 'Breaks rest rule',
            severity: 'caution',
          },
        ],
      }),
    ).toEqual({
      rule_violations_at_log: [
        {
          rule_id: 'rule-rest-foot',
          rule_type: 'rest_between_class',
          message: 'Breaks rest rule',
          severity: 'caution',
        },
      ],
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

describe('mapDashboardFromApi — WTL.F1 weekly progress period and activity fields', () => {
  it('maps period_start and period_end on each weekly progress row', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      weekly_progress: [weeklyProgressActivityScopedSnake],
    });

    expect(mapped.weeklyProgress[0]).toMatchObject({
      periodStart: WTL_F1_PERIOD_START,
      periodEnd: WTL_F1_PERIOD_END,
    });
  });

  it('maps activity_id and activity_name for activity-scoped weekly targets', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      weekly_progress: [weeklyProgressActivityScopedSnake],
    });

    expect(mapped.weeklyProgress[0]).toMatchObject({
      activityId: weeklyProgressActivityScopedSnake.activity_id,
      activityName: weeklyProgressActivityScopedSnake.activity_name,
    });
  });

  it('maps legacy class-scoped rows with null activity fields', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      weekly_progress: [weeklyProgressLegacyClassSnake],
    });

    expect(mapped.weeklyProgress[0]).toMatchObject({
      className: weeklyProgressLegacyClassSnake.class_name,
      activityId: null,
      activityName: null,
    });
  });
});

describe('mapDashboardFromApi — WTL.F4 load-tax graph contract', () => {
  it('maps week_load_threshold null to null instead of coercing to zero', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      week_load_threshold: null,
    });

    expect(mapped.weekLoadThreshold).toBeNull();
  });

  it('maps a 30-day load_series with load-tax daily_load fields', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      as_of: WTL_F4_AS_OF,
      load_series: wtlF4LoadSeriesSnake,
      week_load_threshold: null,
    });

    expect(mapped.loadSeries).toHaveLength(WTL_F4_GRAPH_WINDOW_DAYS);
    expect(mapped.loadSeries[0]).toMatchObject({
      date: WTL_F4_GRAPH_START,
      load: expect.any(Number),
      dailyLoad: expect.any(Number),
    });
    expect(mapped.loadSeries.at(-1)).toMatchObject({
      date: WTL_F4_AS_OF,
      load: expect.any(Number),
      dailyLoad: expect.any(Number),
    });
  });
});

/** Bridge until mapLoadRiskSummaryFromApi returns ruleLimitRows (WTL.F5). */
function asWtlF5LoadRiskSummary(
  mapped: LoadRiskSummary | null,
): LoadRiskSummaryWtlF5 | null {
  return mapped as unknown as LoadRiskSummaryWtlF5 | null;
}

describe('mapLoadRiskSummaryFromApi — WTL.F5 rule-limit row shape', () => {
  it('maps rule_limit_rows with scope, rule metadata, and display fields', () => {
    const mapped = asWtlF5LoadRiskSummary(mapLoadRiskSummaryFromApi(wtlF5FootLoadSummarySnake));

    expect(mapped?.ruleLimitRows).toHaveLength(wtlF5FootLoadSummarySnake.rule_limit_rows.length);
    expect(mapped?.ruleLimitRows[0]).toMatchObject({
      id: wtlF5ClassFrequencyRow.id,
      scope: 'class',
      ruleId: wtlF5ClassFrequencyRow.ruleId,
      ruleType: wtlF5ClassFrequencyRow.ruleType,
      activityClassId: wtlF5ClassFrequencyRow.activityClassId,
      className: wtlF5ClassFrequencyRow.className,
      actual: wtlF5ClassFrequencyRow.actual,
      limit: wtlF5ClassFrequencyRow.limit,
      unit: wtlF5ClassFrequencyRow.unit,
      state: wtlF5ClassFrequencyRow.state,
      label: wtlF5ClassFrequencyRow.label,
      displayMode: 'bar',
    });
  });

  it('maps activity-scoped rows with activity_id and activity_name', () => {
    const mapped = asWtlF5LoadRiskSummary(mapLoadRiskSummaryFromApi(wtlF5FootLoadSummarySnake));
    const walkRow = mapped?.ruleLimitRows.find((row) => row.id === wtlF5WalkWeeklyVolumeRow.id);
    const bikeRow = mapped?.ruleLimitRows.find((row) => row.id === wtlF5BikeDailyVolumeRow.id);

    expect(walkRow).toMatchObject({
      scope: 'activity',
      activityId: wtlF5WalkWeeklyVolumeRow.activityId,
      activityName: wtlF5WalkWeeklyVolumeRow.activityName,
      unit: 'km',
    });
    expect(bikeRow).toMatchObject({
      scope: 'activity',
      activityId: wtlF5BikeDailyVolumeRow.activityId,
      activityName: wtlF5BikeDailyVolumeRow.activityName,
      unit: 'minutes',
    });
  });

  it('maps rest_between_class rows with display_mode status', () => {
    const mapped = asWtlF5LoadRiskSummary(mapLoadRiskSummaryFromApi(wtlF5FootLoadSummarySnake));
    const restRow = mapped?.ruleLimitRows.find((row) => row.id === wtlF5ClassRestRow.id);

    expect(restRow).toMatchObject({
      ruleType: 'rest_between_class',
      displayMode: 'status',
      label: wtlF5ClassRestRow.label,
    });
  });

  it('maps week_days with load-tax state on each cell', () => {
    const mapped = asWtlF5LoadRiskSummary(mapLoadRiskSummaryFromApi(wtlF5FootLoadSummarySnake));

    expect(mapped?.weekDays).toHaveLength(7);
    mapped?.weekDays.forEach((day, index) => {
      expect(day).toMatchObject({
        date: wtlF5WeekDays[index]!.date,
        flagged: wtlF5WeekDays[index]!.flagged,
        state: wtlF5WeekDays[index]!.state,
      });
    });
  });

  it('maps empty rule_limit_rows to an empty array', () => {
    const mapped = asWtlF5LoadRiskSummary(mapLoadRiskSummaryFromApi(wtlF5EmptySummarySnake));

    expect(mapped?.ruleLimitRows).toEqual([]);
    expect(mapped?.weekDays).toHaveLength(7);
  });

  it('maps load_risk_summary through dashboard payload', () => {
    const mapped = mapDashboardFromApi({
      ...dashboardReadSnake,
      load_risk_summary: wtlF5FootLoadSummarySnake,
    });
    const loadRisk = asWtlF5LoadRiskSummary(mapped.loadRiskSummary);

    expect(loadRisk?.ruleLimitRows).toHaveLength(
      wtlF5FootLoadSummarySnake.rule_limit_rows.length,
    );
    expect(loadRisk?.weekDays[0]).toMatchObject({
      date: wtlF5WeekDays[0]!.date,
      state: wtlF5WeekDays[0]!.state,
    });
  });
});

describe('mapLoadSummaryFromApi — WTL.F1 weekly progress metadata', () => {
  it('maps period and activity fields on weekly_progress rows', () => {
    const mapped = mapLoadSummaryFromApi({
      as_of: WTL_F1_PERIOD_END,
      class_statuses: [],
      suggestions: [],
      weekly_progress: [weeklyProgressActivityScopedSnake],
    });

    expect(mapped.weeklyProgress[0]).toMatchObject({
      periodStart: WTL_F1_PERIOD_START,
      periodEnd: WTL_F1_PERIOD_END,
      activityId: weeklyProgressActivityScopedSnake.activity_id,
      activityName: weeklyProgressActivityScopedSnake.activity_name,
    });
  });
});
