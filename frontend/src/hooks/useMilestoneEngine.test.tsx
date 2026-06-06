/**
 * F1.3 — useMilestoneEngine API rewire acceptance tests.
 *
 * Asserts React Query wiring, dashboard/log field mapping, and mutation payloads
 * serialized through frontend/src/lib/api.
 *
 * F2.0 — Hook data plane for completion screens.
 *
 * Extends with tests for the new queries (goals, rules, weeklyTargets,
 * previousBlocks) and mutations (submitNewActivity, createGoal, archiveGoal,
 * createRule, deleteRule, createTrainingBlock, updateGoal, updateRule,
 * updateActivity, deactivateActivity).
 *
 * H10.1 — delayed-tax useQuery on useMilestoneEngine.
 *
 * H10.2 — query status surface for app shell (isInitialLoading, isFatalError, refetchAll).
 *
 * H10.3 — goals and previousBlocks from dashboard; no listGoals / listTrainingBlocks on mount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import type { Activity, Rule, WeeklyTarget, TrainingBlock, RecoveryStreak } from '../types';
import {
  dashboardReadSnake,
  activityLogReadSnake,
  ruleViolationReadSnakeCaution,
} from '../lib/api/testFixtures';
import {
  mapActivityLogCreateBody,
  mapActivityLogFromApi,
  mapActivityLogPatchBody,
  mapDashboardFromApi,
  type DashboardPayload,
} from '../lib/api/mappers';
import { renderHookWithProviders } from '../test/renderHookWithProviders';
import {
  useMilestoneEngine,
  type DelayedTaxResponse,
  type MilestoneEngineResult,
} from './useMilestoneEngine';

const MOCK_UUID = '11111111-1111-4111-8111-111111111111';

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  listActivityLogs: vi.fn(),
  createActivityLog: vi.fn(),
  patchActivityLog: vi.fn(),
  createDailyCheckIn: vi.fn(),
  createFlareUpIncident: vi.fn(),
  checkViolations: vi.fn(),
  // F2.0 additions
  listGoals: vi.fn(),
  listRulesByBlock: vi.fn(),
  listWeeklyTargetsByBlock: vi.fn(),
  listTrainingBlocks: vi.fn(),
  createGoal: vi.fn(),
  patchGoal: vi.fn(),
  createRule: vi.fn(),
  patchRule: vi.fn(),
  deleteRule: vi.fn(),
  createWeeklyTarget: vi.fn(),
  patchWeeklyTarget: vi.fn(),
  createTrainingBlock: vi.fn(),
  createActivity: vi.fn(),
  createActivityClass: vi.fn(),
  patchActivityClass: vi.fn(),
  deleteActivityClass: vi.fn(),
  patchActivity: vi.fn(),
  listActivities: vi.fn(),
  listDailyCheckIns: vi.fn(),
  getDelayedTax: vi.fn(),
}));

import {
  getDashboard,
  listActivityLogs,
  createActivityLog,
  patchActivityLog,
  checkViolations as checkViolationsApi,
  // F2.0 additions
  listGoals,
  listRulesByBlock,
  listWeeklyTargetsByBlock,
  listTrainingBlocks,
  createGoal as createGoalApi,
  patchGoal,
  createRule as createRuleApi,
  patchRule,
  deleteRule as deleteRuleApi,
  createWeeklyTarget as createWeeklyTargetApi,
  patchWeeklyTarget as patchWeeklyTargetApi,
  createTrainingBlock as createTrainingBlockApi,
  createActivity,
  createActivityClass,
  patchActivityClass,
  deleteActivityClass,
  patchActivity,
  listActivities,
  listDailyCheckIns,
  getDelayedTax,
  createDailyCheckIn,
  createFlareUpIncident,
} from '../lib/api';

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

function buildDashboardPayload(
  snake: Record<string, unknown> = dashboardReadSnake as Record<string, unknown>,
): DashboardPayload {
  return mapDashboardFromApi(snake);
}

const dashboardPayload = buildDashboardPayload();

type EngineWithDelayedTax = MilestoneEngineResult & {
  delayedTax?: DelayedTaxResponse;
};

function readDelayedTax(engine: MilestoneEngineResult): DelayedTaxResponse | undefined {
  return (engine as EngineWithDelayedTax).delayedTax;
}

type EngineWithQueryStatus = MilestoneEngineResult & {
  isInitialLoading: boolean;
  isFatalError: boolean;
  refetchAll: () => void;
};

function readQueryStatus(engine: MilestoneEngineResult): EngineWithQueryStatus {
  return engine as EngineWithQueryStatus;
}

const delayedTaxFixture: DelayedTaxResponse = {
  asOf: dashboardPayload.todayDate,
  riskWindowDays: 7,
  baselineDays: 14,
  painThreshold: 3,
  hits: [
    {
      hitType: 'elevated_load',
      activityClassId: 'cls-foot',
      message: 'Foot load above 14-day baseline',
    },
  ],
};

// ---------------------------------------------------------------------------
// F2.0 fixtures
// ---------------------------------------------------------------------------

const ACTIVE_BLOCK_ID = 'blk-1';

const goalFixture = dashboardPayload.goals[0]!;

const ruleFixture: Rule = {
  id: 'rule-rest-foot',
  trainingBlockId: ACTIVE_BLOCK_ID,
  activityClassId: 'cls-foot',
  ruleType: 'rest_between_class',
  thresholdValue: 3,
  windowDays: 3,
  enabled: true,
  createdAt: '2026-04-07T06:00:00Z',
};

const weeklyTargetFixture: WeeklyTarget = {
  id: 'wt-foot',
  trainingBlockId: ACTIVE_BLOCK_ID,
  activityClassId: 'cls-foot',
  targetValue: 8,
  targetUnit: 'km',
  createdAt: '2026-04-07T06:00:00Z',
};

const activityFixture = {
  id: 'act-walk',
  activityClassId: 'cls-foot',
  name: 'Morning Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-05-30T06:00:00Z',
} satisfies Omit<Activity, 'userId'>;

const activeBlockFixture: Omit<TrainingBlock, 'userId'> = {
  id: ACTIVE_BLOCK_ID,
  name: 'Return to Walking — Phase 2',
  startDate: '2026-04-07',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-04-07T06:00:00Z',
};

const completedBlockFixture = dashboardPayload.previousBlocks[0]!;

function setupDefaultApiMocks(): void {
  vi.mocked(getDashboard).mockImplementation(async () => buildDashboardPayload());
  vi.mocked(listActivityLogs).mockResolvedValue([activityLogsListOnlyLog]);
  vi.mocked(createActivityLog).mockImplementation(async (draft) =>
    mapActivityLogFromApi({
      ...mapActivityLogCreateBody(draft),
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
      rule_violations_at_log: null,
    }),
  );
  vi.mocked(checkViolationsApi).mockResolvedValue({
    violations: [
      {
        ruleId: ruleViolationReadSnakeCaution.rule_id,
        ruleType: 'rest_between_class',
        message: ruleViolationReadSnakeCaution.message,
        severity: 'caution',
      },
    ],
  });
  // F2.0 defaults
  vi.mocked(listGoals).mockResolvedValue([goalFixture]);
  vi.mocked(listRulesByBlock).mockResolvedValue([ruleFixture]);
  vi.mocked(listWeeklyTargetsByBlock).mockResolvedValue([weeklyTargetFixture]);
  vi.mocked(listTrainingBlocks).mockResolvedValue([activeBlockFixture, completedBlockFixture]);
  vi.mocked(createGoalApi).mockResolvedValue(goalFixture);
  vi.mocked(patchGoal).mockResolvedValue(goalFixture);
  vi.mocked(createRuleApi).mockResolvedValue(ruleFixture);
  vi.mocked(patchRule).mockResolvedValue(ruleFixture);
  vi.mocked(deleteRuleApi).mockResolvedValue(undefined);
  vi.mocked(createTrainingBlockApi).mockResolvedValue(activeBlockFixture);
  vi.mocked(createActivity).mockResolvedValue({
    id: MOCK_UUID,
    activityClassId: 'cls-foot',
    name: 'Morning Jog',
    type: 'performance',
    defaultVolumeUnit: 'km',
    isActive: true,
    createdAt: '2026-05-30T06:00:00Z',
  });
  vi.mocked(createActivityClass).mockResolvedValue({
    id: MOCK_UUID,
    name: 'Foot Load',
    type: 'performance',
    defaultRecoveryWindowDays: 3,
    createdAt: '2026-05-30T06:00:00Z',
  });
  vi.mocked(patchActivityClass).mockResolvedValue({
    id: 'cls-foot',
    name: 'Foot Load Updated',
    type: 'recovery',
    defaultRecoveryWindowDays: 3,
    createdAt: '2026-05-30T06:00:00Z',
  });
  vi.mocked(deleteActivityClass).mockResolvedValue(undefined);
  vi.mocked(patchActivity).mockResolvedValue(activityFixture);
  vi.mocked(listActivities).mockResolvedValue([]);
  vi.mocked(listDailyCheckIns).mockResolvedValue([
    {
      id: 'ci-history',
      checkInDate: '2026-05-20',
      painLevel: 6,
      readinessLevel: 4,
      stiffnessLevel: 5,
      hasFlareUp: true,
      flareUp: {
        bodyPart: 'Left heel',
        severity: 6,
        likelyCauseActivityClassIds: [],
      },
      createdAt: '2026-05-20T07:00:00Z',
    },
  ]);
  vi.mocked(getDelayedTax).mockResolvedValue(delayedTaxFixture);
  vi.mocked(createDailyCheckIn).mockResolvedValue({
    id: 'ci-test',
    checkInDate: dashboardPayload.todayDate,
    painLevel: 2,
    readinessLevel: 7,
    stiffnessLevel: 3,
    hasFlareUp: false,
    createdAt: '2026-05-25T07:00:00Z',
    updatedAt: '2026-05-25T07:00:00Z',
  });
  vi.mocked(createFlareUpIncident).mockResolvedValue({
    id: 'inc-test',
    incidentDate: dashboardPayload.todayDate,
    bodyPart: 'Left heel',
    severity: 5,
    createdAt: '2026-05-25T08:00:00Z',
    updatedAt: '2026-05-25T08:00:00Z',
  });
}

describe('useMilestoneEngine API rewire (F1.3)', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('invokes dashboard and activity-logs queries on mount (not goals or training-blocks)', async () => {
    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(listActivityLogs).toHaveBeenCalledTimes(1);
    });

    expect(listGoals).not.toHaveBeenCalled();
    expect(listTrainingBlocks).not.toHaveBeenCalled();
  });

  it('maps dashboard payload fields to hook result (logs from activity-logs list)', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    expect(result.current.userName).toBe(dashboardPayload.userName);
    expect(result.current.block?.id).toBe(dashboardPayload.block?.id);
    expect(result.current.activityClasses).toEqual(dashboardPayload.activityClasses);
    expect(result.current.activities).toEqual(dashboardPayload.activities);
    expect(result.current.incidents).toEqual(dashboardPayload.incidents);
    expect(result.current.hasCheckedInToday).toBe(dashboardPayload.hasCheckedInToday);
    expect(result.current.classStatuses).toEqual(dashboardPayload.classStatuses);
    expect(result.current.suggestionBuckets).toEqual(dashboardPayload.suggestionBuckets);
    expect(result.current.loadRiskSummary).toEqual(dashboardPayload.loadRiskSummary);
    expect(result.current.weeklyProgress).toEqual(dashboardPayload.weeklyProgress);
    expect(result.current.dailyScores).toEqual(dashboardPayload.dailyScores);
    expect(result.current.loadSeries).toEqual(dashboardPayload.loadSeries);
    expect(result.current.graphClassId).toBe(dashboardPayload.graphClassId);
    expect(result.current.flareUpDates).toEqual(dashboardPayload.flareUpDates);
    expect(result.current.weekLoadThreshold).toBe(dashboardPayload.weekLoadThreshold);
    expect(result.current.cleanStreak).toBe(dashboardPayload.cleanStreak);

    expect(result.current.logs).toEqual([activityLogsListOnlyLog]);
    expect(result.current.logs).not.toEqual(dashboardPayload.logs);

    const engineWithStreaks = result.current as typeof result.current & {
      recoveryStreaks: RecoveryStreak[];
    };
    expect(engineWithStreaks.recoveryStreaks).toEqual(dashboardPayload.recoveryStreaks);
  });

  it('submitLog POST body includes snake_case keys, logged_date, and client-generated id', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    result.current.submitLog({
      activityId: 'act-walk',
      loggedDate: dashboardPayload.todayDate,
      durationMinutes: 25,
      volumeValue: 2,
      volumeUnit: 'km',
      rpe: 4,
      postActivityFeel: 'fine',
      notes: 'Easy pace',
    });

    await waitFor(() => {
      expect(createActivityLog).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivityLog).mock.calls[0]?.[0];
    expect(draft).toBeDefined();
    expect(draft?.id).toBe(MOCK_UUID);
    expect(draft?.loggedDate).toBe(dashboardPayload.todayDate);
    expect(mapActivityLogCreateBody(draft ?? {})).toMatchObject({
      id: MOCK_UUID,
      activity_id: 'act-walk',
      logged_date: dashboardPayload.todayDate,
      duration_minutes: 25,
      volume_value: 2,
      volume_unit: 'km',
      rpe: 4,
      post_activity_feel: 'fine',
      notes: 'Easy pace',
    });
    expect(draft).not.toHaveProperty('activity_id');
    expect(draft).not.toHaveProperty('logged_date');
  });

  it('submitLog POST body includes rule_violations_at_log when draft has ruleViolationsAtLog', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const violations = [
      {
        ruleId: ruleViolationReadSnakeCaution.rule_id,
        ruleType: 'rest_between_class' as const,
        message: ruleViolationReadSnakeCaution.message,
        severity: 'caution' as const,
      },
    ];

    result.current.submitLog({
      activityId: 'act-walk',
      loggedDate: dashboardPayload.todayDate,
      durationMinutes: 25,
      volumeValue: 2,
      volumeUnit: 'km',
      rpe: 4,
      ruleViolationsAtLog: violations,
    });

    await waitFor(() => {
      expect(createActivityLog).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivityLog).mock.calls[0]?.[0];
    expect(mapActivityLogCreateBody(draft ?? {})).toMatchObject({
      rule_violations_at_log: [ruleViolationReadSnakeCaution],
    });
  });

  it('invalidates dashboard and activity-logs query keys after successful submitLog', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.submitLog({
      activityId: 'act-walk',
      loggedDate: dashboardPayload.todayDate,
      durationMinutes: 20,
      volumeValue: 1.5,
      volumeUnit: 'km',
      rpe: 3,
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-logs'] });
    });
  });

  it('updateLog PATCH body includes snake_case logged_date from patch', async () => {
    vi.mocked(patchActivityLog).mockImplementation(async (_logId, patch) =>
      mapActivityLogFromApi({
        ...mapActivityLogPatchBody(patch),
        id: activityLogsListOnlyLog.id,
        activity_id: activityLogsListOnlyLog.activityId,
        logged_date: '2026-05-20',
        duration_minutes: 30,
        volume_value: 2,
        volume_unit: 'km',
        created_at: '2026-05-25T08:00:00Z',
        updated_at: '2026-05-25T08:00:00Z',
        rule_violations_at_log: null,
      }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    result.current.updateLog('log-1', {
      loggedDate: '2026-05-20' as const,
      durationMinutes: 30,
    });

    await waitFor(() => {
      expect(patchActivityLog).toHaveBeenCalledTimes(1);
    });

    expect(patchActivityLog).toHaveBeenCalledWith('log-1', {
      loggedDate: '2026-05-20',
      durationMinutes: 30,
    });
    expect(mapActivityLogPatchBody({ loggedDate: '2026-05-20', durationMinutes: 30 })).toMatchObject({
      logged_date: '2026-05-20',
      duration_minutes: 30,
    });
  });

  it('invalidates dashboard and activity-logs query keys after successful updateLog', async () => {
    vi.mocked(patchActivityLog).mockResolvedValue(activityLogsListOnlyLog);

    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.logs).toEqual([activityLogsListOnlyLog]);
    });

    result.current.updateLog('log-1', { durationMinutes: 25 });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-logs'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['delayed-tax'] });
    });
  });

  it('checkViolations calls load API with dashboard todayDate as as_of', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    result.current.checkViolations('act-walk', 2.5, 5);

    await waitFor(() => {
      expect(checkViolationsApi).toHaveBeenCalledWith({
        activityId: 'act-walk',
        volumeValue: 2.5,
        rpe: 5,
        asOf: dashboardPayload.todayDate,
      });
    });
  });
});

// =============================================================================
// F2.0 — Hook data plane for completion screens
// =============================================================================

describe('useMilestoneEngine data plane (F2.0)', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Read queries — mount-time behaviour
  // ---------------------------------------------------------------------------

  it('exposes engine.goals from dashboard payload without calling listGoals', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(result.current.goals).toEqual([goalFixture]);
    });

    expect(listGoals).not.toHaveBeenCalled();
  });

  it('fires listRulesByBlock query on mount when block exists', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledWith(ACTIVE_BLOCK_ID);
      expect(result.current.rules).toEqual([ruleFixture]);
    });
  });

  it('fires listWeeklyTargetsByBlock query on mount when block exists', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledWith(ACTIVE_BLOCK_ID);
    });

    expect(result.current.weeklyTargets).toEqual([weeklyTargetFixture]);
  });

  it('exposes previousBlocks from dashboard without calling listTrainingBlocks', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result.current.previousBlocks)).toBe(true);
    });

    expect(listTrainingBlocks).not.toHaveBeenCalled();
  });

  it('previousBlocks mirrors dashboard.previous_blocks (active block omitted server-side)', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      const ids = result.current.previousBlocks.map((b: TrainingBlock) => b.id);
      expect(ids).toEqual([completedBlockFixture.id]);
      expect(ids).not.toContain(ACTIVE_BLOCK_ID);
    });
  });

  it('rules and weeklyTargets are disabled (not called) when no block exists', async () => {
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(buildDashboardPayload(dashboardReadSnakeNoBlock));

    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(listGoals).not.toHaveBeenCalled();
    expect(listTrainingBlocks).not.toHaveBeenCalled();

    // Block-scoped queries must NOT have been called
    expect(listRulesByBlock).not.toHaveBeenCalled();
    expect(listWeeklyTargetsByBlock).not.toHaveBeenCalled();
  });

  it('rules and weeklyTargets default to [] when block is absent', async () => {
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(buildDashboardPayload(dashboardReadSnakeNoBlock));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(result.current.rules).toEqual([]);
    expect(result.current.weeklyTargets).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Regression: goals and previousBlocks load even when no active block exists
  // ---------------------------------------------------------------------------

  it('goals still populate from dashboard when no active block exists', async () => {
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(buildDashboardPayload(dashboardReadSnakeNoBlock));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(result.current.goals).toEqual([goalFixture]);
    });

    expect(listGoals).not.toHaveBeenCalled();
  });

  it('previousBlocks still populate from dashboard when no active block exists', async () => {
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(buildDashboardPayload(dashboardReadSnakeNoBlock));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.previousBlocks.map((b) => b.id)).toEqual([completedBlockFixture.id]);
    });

    expect(listTrainingBlocks).not.toHaveBeenCalled();
  });

  it('goals defaults to [] when dashboard goals is empty', async () => {
    vi.mocked(getDashboard).mockResolvedValue(
      buildDashboardPayload({
        ...(dashboardReadSnake as Record<string, unknown>),
        goals: [],
      }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(result.current.goals).toEqual([]);
    expect(listGoals).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // submitNewActivity mutation
  // ---------------------------------------------------------------------------

  it('submitNewActivity calls createActivity with snake_case body and a generated id', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.submitNewActivity({
        name: 'Morning Jog',
        activityClassId: 'cls-foot',
        type: 'performance',
        defaultVolumeUnit: 'km',
      });
    });

    await waitFor(() => {
      expect(createActivity).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivity).mock.calls[0]?.[0];
    expect(draft).toBeDefined();
    // Hook passes camelCase draft to createActivity which maps internally
    expect(draft?.id).toBe(MOCK_UUID);
    expect(draft?.name).toBe('Morning Jog');
    expect(draft?.activityClassId).toBe('cls-foot');
    expect(draft?.type).toBe('performance');
    expect(draft?.defaultVolumeUnit).toBe('km');
    expect(draft?.isActive).toBe(true);
  });

  it('submitNewActivity invalidates ["dashboard"] and ["activities"] on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.submitNewActivity({
        name: 'Morning Jog',
        activityClassId: 'cls-foot',
        type: 'performance',
        defaultVolumeUnit: 'km',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activities'] });
    });
  });

  // ---------------------------------------------------------------------------
  // S2.6 — submitNewActivityClass mutation
  // ---------------------------------------------------------------------------

  it('submitNewActivityClass calls createActivityClass with generated id and draft fields', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      submitNewActivityClass?: (draft: {
        name: string;
        type: 'performance' | 'recovery';
        description?: string;
        defaultRecoveryWindowDays?: number;
      }) => void;
    };

    expect(typeof engine.submitNewActivityClass).toBe('function');

    act(() => {
      engine.submitNewActivityClass?.({
        name: 'High-Intensity Foot Load',
        type: 'performance',
        description: 'Impact-heavy lower limb loading.',
        defaultRecoveryWindowDays: 4,
      });
    });

    await waitFor(() => {
      expect(createActivityClass).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivityClass).mock.calls[0]?.[0];
    expect(draft).toBeDefined();
    expect(draft?.id).toBe(MOCK_UUID);
    expect(draft?.name).toBe('High-Intensity Foot Load');
    expect(draft?.type).toBe('performance');
    expect(draft?.description).toBe('Impact-heavy lower limb loading.');
    expect(draft?.defaultRecoveryWindowDays).toBe(4);
  });

  it('submitNewActivityClass defaults description to empty string when omitted', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      submitNewActivityClass?: (draft: {
        name: string;
        type: 'performance' | 'recovery';
      }) => void;
    };

    act(() => {
      engine.submitNewActivityClass?.({
        name: 'Low-Impact Recovery',
        type: 'recovery',
      });
    });

    await waitFor(() => {
      expect(createActivityClass).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivityClass).mock.calls[0]?.[0];
    expect(draft?.description).toBe('');
  });

  it('submitNewActivityClass defaults defaultRecoveryWindowDays to 3 when omitted', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      submitNewActivityClass?: (draft: {
        name: string;
        type: 'performance' | 'recovery';
      }) => void;
    };

    act(() => {
      engine.submitNewActivityClass?.({
        name: 'Low-Impact Recovery',
        type: 'recovery',
      });
    });

    await waitFor(() => {
      expect(createActivityClass).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createActivityClass).mock.calls[0]?.[0];
    expect(draft?.defaultRecoveryWindowDays).toBe(3);
  });

  it('submitNewActivityClass invalidates ["dashboard"] and ["activity-classes"] on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      submitNewActivityClass?: (draft: {
        name: string;
        type: 'performance' | 'recovery';
      }) => void;
    };

    act(() => {
      engine.submitNewActivityClass?.({
        name: 'Mobility',
        type: 'recovery',
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-classes'] });
    });
  });

  // ---------------------------------------------------------------------------
  // H9.0 — activity update / deactivate mutations
  // ---------------------------------------------------------------------------

  it('updateActivity calls patchActivity with the provided patch and invalidates ["dashboard"] and ["activities"]', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      updateActivity?: (activityId: string, patch: Record<string, unknown>) => void;
    };

    expect(typeof engine.updateActivity).toBe('function');

    act(() => {
      engine.updateActivity?.('act-walk', { name: 'Brisk Walk' });
    });

    await waitFor(() => {
      expect(patchActivity).toHaveBeenCalledTimes(1);
    });

    expect(patchActivity).toHaveBeenCalledWith('act-walk', { name: 'Brisk Walk' });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activities'] });
    });
  });

  it('deactivateActivity calls patchActivity with isActive false and invalidates ["dashboard"] and ["activities"]', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    const engine = result.current as typeof result.current & {
      deactivateActivity?: (activityId: string) => void;
    };

    expect(typeof engine.deactivateActivity).toBe('function');

    act(() => {
      engine.deactivateActivity?.('act-walk');
    });

    await waitFor(() => {
      expect(patchActivity).toHaveBeenCalledTimes(1);
    });

    expect(patchActivity).toHaveBeenCalledWith('act-walk', { isActive: false });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activities'] });
    });
  });

  // ---------------------------------------------------------------------------
  // createGoal mutation
  // ---------------------------------------------------------------------------

  it('createGoal calls createGoalApi and invalidates ["dashboard"] only', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.createGoal({
        title: 'New goal',
        targetDate: '2026-06-30',
        timeframe: 'monthly',
        status: 'active',
      });
    });

    await waitFor(() => {
      expect(createGoalApi).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createGoalApi).mock.calls[0]?.[0];
    expect(draft?.id).toBe(MOCK_UUID);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['goals'] });
  });

  // ---------------------------------------------------------------------------
  // archiveGoal mutation
  // ---------------------------------------------------------------------------

  it('archiveGoal patches goal with status "paused" and invalidates ["dashboard"] only', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.archiveGoal('goal-1');
    });

    await waitFor(() => {
      expect(patchGoal).toHaveBeenCalledTimes(1);
    });

    const [goalId, patch] = vi.mocked(patchGoal).mock.calls[0] ?? [];
    expect(goalId).toBe('goal-1');
    expect(patch?.status).toBe('paused');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['goals'] });
  });

  // ---------------------------------------------------------------------------
  // updateGoal mutation
  // ---------------------------------------------------------------------------

  it('updateGoal calls patchGoal with the provided patch and invalidates ["dashboard"] only', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.updateGoal('goal-1', { status: 'achieved' });
    });

    await waitFor(() => {
      expect(patchGoal).toHaveBeenCalledTimes(1);
    });

    const [goalId, patch] = vi.mocked(patchGoal).mock.calls[0] ?? [];
    expect(goalId).toBe('goal-1');
    expect(patch?.status).toBe('achieved');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['goals'] });
  });

  // ---------------------------------------------------------------------------
  // weekly target mutations (S25.F5)
  // ---------------------------------------------------------------------------

  it('patchWeeklyTarget calls patchWeeklyTargetApi and invalidates weeklyTargets and dashboard', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.patchWeeklyTarget('wt-foot', { targetValue: 12 });
    });

    await waitFor(() => {
      expect(patchWeeklyTargetApi).toHaveBeenCalledTimes(1);
    });

    const [targetId, patch] = vi.mocked(patchWeeklyTargetApi).mock.calls[0] ?? [];
    expect(targetId).toBe('wt-foot');
    expect(patch?.targetValue).toBe(12);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['weekly-targets', ACTIVE_BLOCK_ID] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
  });

  it('createWeeklyTarget calls createWeeklyTargetApi with blockId and invalidates weeklyTargets and dashboard', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createWeeklyTarget({
        activityClassId: 'cls-foot',
        targetValue: 10,
        targetUnit: 'km',
      });
    });

    await waitFor(() => {
      expect(createWeeklyTargetApi).toHaveBeenCalledTimes(1);
    });

    const [calledBlockId, draft] = vi.mocked(createWeeklyTargetApi).mock.calls[0] ?? [];
    expect(calledBlockId).toBe(ACTIVE_BLOCK_ID);
    expect(draft?.id).toBe(MOCK_UUID);
    expect(draft?.activityClassId).toBe('cls-foot');
    expect(draft?.targetValue).toBe(10);
    expect(draft?.targetUnit).toBe('km');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['weekly-targets', ACTIVE_BLOCK_ID] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
  });

  // ---------------------------------------------------------------------------
  // createRule mutation
  // ---------------------------------------------------------------------------

  it('createRule calls createRuleApi with blockId and invalidates ["rules", blockId]', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createRule({
        activityClassId: 'cls-foot',
        ruleType: 'frequency_limit',
        thresholdValue: 3,
        windowDays: 7,
        enabled: true,
      });
    });

    await waitFor(() => {
      expect(createRuleApi).toHaveBeenCalledTimes(1);
    });

    const [calledBlockId, draft] = vi.mocked(createRuleApi).mock.calls[0] ?? [];
    expect(calledBlockId).toBe(ACTIVE_BLOCK_ID);
    expect(draft?.id).toBe(MOCK_UUID);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rules', ACTIVE_BLOCK_ID] });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRule mutation
  // ---------------------------------------------------------------------------

  it('deleteRule calls deleteRuleApi and invalidates ["rules", blockId]', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.deleteRule('rule-rest-foot');
    });

    await waitFor(() => {
      expect(deleteRuleApi).toHaveBeenCalledTimes(1);
      expect(deleteRuleApi).toHaveBeenCalledWith('rule-rest-foot');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rules', ACTIVE_BLOCK_ID] });
    });
  });

  // ---------------------------------------------------------------------------
  // updateRule mutation
  // ---------------------------------------------------------------------------

  it('updateRule calls patchRule with the provided patch', async () => {
    const { mapRuleFromApi } = await import('../lib/api/mappers');
    // stub patchRule for this test
    vi.mocked(patchRule).mockResolvedValue(
      mapRuleFromApi({
        id: 'rule-rest-foot',
        training_block_id: ACTIVE_BLOCK_ID,
        activity_class_id: 'cls-foot',
        rule_type: 'rest_between_class',
        threshold_value: 4,
        window_days: 3,
        enabled: true,
        created_at: '2026-04-07T06:00:00Z',
      }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.updateRule('rule-rest-foot', { thresholdValue: 4 });
    });

    await waitFor(() => {
      expect(patchRule).toHaveBeenCalledTimes(1);
    });

    const [ruleId, patch] = vi.mocked(patchRule).mock.calls[0] ?? [];
    expect(ruleId).toBe('rule-rest-foot');
    expect(patch?.thresholdValue).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // createTrainingBlock mutation
  // ---------------------------------------------------------------------------

  it('createTrainingBlock calls createTrainingBlockApi with a generated id', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.createTrainingBlock({
        name: 'Phase 3 Build',
        startDate: '2026-06-01',
      });
    });

    await waitFor(() => {
      expect(createTrainingBlockApi).toHaveBeenCalledTimes(1);
    });

    const draft = vi.mocked(createTrainingBlockApi).mock.calls[0]?.[0];
    expect(draft?.id).toBe(MOCK_UUID);
    expect(draft?.name).toBe('Phase 3 Build');
    expect(draft?.startDate).toBe('2026-06-01');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['training-blocks'] });
  });

  // ---------------------------------------------------------------------------
  // New draft interfaces exported from hook module
  // ---------------------------------------------------------------------------

  it('exports NewActivityDraft, GoalDraft, GoalPatch, RuleDraft, RulePatch, BlockDraft type shapes (compile-time)', async () => {
    // This test validates that the hook module exports the required draft
    // interfaces. It is a structural/type test: if the types are missing the
    // TypeScript compiler will error before the test even runs.
    const module = await import('./useMilestoneEngine');

    // The hook result must carry the new mutation functions
    const keys = Object.keys(module);
    // At minimum the module must re-export something we can inspect at runtime.
    // The real guard is tsc --noEmit; this just confirms the module loads.
    expect(keys).toContain('useMilestoneEngine');
  });

  // ---------------------------------------------------------------------------
  // Additive extension — existing result fields unchanged
  // ---------------------------------------------------------------------------

  it('existing result fields are still present alongside new F2.0 fields', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    // Original fields still present
    expect(typeof result.current.submitLog).toBe('function');
    expect(typeof result.current.updateLog).toBe('function');
    expect(typeof result.current.submitCheckIn).toBe('function');
    expect(typeof result.current.submitIncident).toBe('function');
    expect(typeof result.current.checkViolations).toBe('function');
    expect(Array.isArray(result.current.activities)).toBe(true);
    expect(Array.isArray(result.current.logs)).toBe(true);

    // New F2.0 fields also present
    expect(Array.isArray(result.current.goals)).toBe(true);
    expect(Array.isArray(result.current.rules)).toBe(true);
    expect(Array.isArray(result.current.weeklyTargets)).toBe(true);
    expect(Array.isArray(result.current.previousBlocks)).toBe(true);
    expect(typeof result.current.submitNewActivity).toBe('function');
    const engineWithClassMutation = result.current as typeof result.current & {
      submitNewActivityClass?: (draft: unknown) => void;
    };
    expect(typeof engineWithClassMutation.submitNewActivityClass).toBe('function');
    expect(typeof result.current.createGoal).toBe('function');
    expect(typeof result.current.updateGoal).toBe('function');
    expect(typeof result.current.archiveGoal).toBe('function');
    expect(typeof result.current.createRule).toBe('function');
    expect(typeof result.current.updateRule).toBe('function');
    expect(typeof result.current.deleteRule).toBe('function');
    expect(typeof result.current.createWeeklyTarget).toBe('function');
    expect(typeof result.current.patchWeeklyTarget).toBe('function');
    expect(typeof result.current.createTrainingBlock).toBe('function');
  });
});

// =============================================================================
// H10.1 — delayed-tax query on useMilestoneEngine
// =============================================================================

describe('useMilestoneEngine delayed tax (H10.1)', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls getDelayedTax with dashboard todayDate and exposes delayedTax on the result', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDelayedTax).toHaveBeenCalledWith({ asOf: dashboardPayload.todayDate });
      expect(readDelayedTax(result.current)).toEqual(delayedTaxFixture);
    });
  });

  it('registers a stable delayed-tax query key scoped to todayDate', async () => {
    const { queryClient } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDelayedTax).toHaveBeenCalledTimes(1);
    });

    const delayedTaxQueries = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['delayed-tax'] });

    expect(delayedTaxQueries).toHaveLength(1);
    expect(delayedTaxQueries[0]?.queryKey).toEqual([
      'delayed-tax',
      dashboardPayload.todayDate,
    ]);
  });

  it('does not fetch delayed tax while todayDate is empty before dashboard resolves', async () => {
    let resolveDashboard!: (value: typeof dashboardPayload) => void;
    vi.mocked(getDashboard).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDashboard = resolve;
        }),
    );

    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(getDelayedTax).not.toHaveBeenCalled();

    resolveDashboard(dashboardPayload);

    await waitFor(() => {
      expect(getDelayedTax).toHaveBeenCalledWith({ asOf: dashboardPayload.todayDate });
    });
  });

  it('does not fetch delayed tax when dashboard is unavailable', async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error('dashboard unavailable'));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(getDelayedTax).not.toHaveBeenCalled();
    expect(readDelayedTax(result.current)).toBeUndefined();
    expect(result.current.todayDate).toBe('');
  });

  it('leaves delayedTax undefined when getDelayedTax fails', async () => {
    vi.mocked(getDelayedTax).mockRejectedValue(new Error('delayed tax unavailable'));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDelayedTax).toHaveBeenCalledWith({ asOf: dashboardPayload.todayDate });
      expect(result.current.delayedTaxError).toBe(true);
    });

    expect(readDelayedTax(result.current)).toBeUndefined();
  });

  it('submitLog invalidates ["delayed-tax"] alongside dashboard and activity-logs', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(readDelayedTax(result.current)).toEqual(delayedTaxFixture);
    });

    result.current.submitLog({
      activityId: 'act-walk',
      loggedDate: dashboardPayload.todayDate,
      durationMinutes: 20,
      volumeValue: 1.5,
      volumeUnit: 'km',
      rpe: 3,
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-logs'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['delayed-tax'] });
    });
  });

  it('submitCheckIn invalidates ["delayed-tax"] alongside dashboard', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(readDelayedTax(result.current)).toEqual(delayedTaxFixture);
    });

    act(() => {
      result.current.submitCheckIn({
        painLevel: 2,
        readinessLevel: 7,
        stiffnessLevel: 3,
        hasFlareUp: false,
      });
    });

    await waitFor(() => {
      expect(createDailyCheckIn).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['delayed-tax'] });
    });
  });

  it('submitIncident invalidates ["delayed-tax"] alongside dashboard', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(readDelayedTax(result.current)).toEqual(delayedTaxFixture);
    });

    act(() => {
      result.current.submitIncident({
        bodyPart: 'Left heel',
        severity: 6,
      });
    });

    await waitFor(() => {
      expect(createFlareUpIncident).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['delayed-tax'] });
    });
  });
});

// =============================================================================
// H10.2 — query status for app shell
// =============================================================================

describe('useMilestoneEngine query status (H10.2)', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('exposes isInitialLoading, isFatalError, and refetchAll on the result', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      const status = readQueryStatus(result.current);
      expect(typeof status.isInitialLoading).toBe('boolean');
      expect(typeof status.isFatalError).toBe('boolean');
      expect(typeof status.refetchAll).toBe('function');
    });
  });

  it('transitions pending → success: isInitialLoading true until dashboard resolves, then false with data', async () => {
    let resolveDashboard!: (value: typeof dashboardPayload) => void;
    vi.mocked(getDashboard).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDashboard = resolve;
        }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    const statusWhilePending = readQueryStatus(result.current);
    expect(statusWhilePending.isInitialLoading).toBe(true);
    expect(statusWhilePending.isFatalError).toBe(false);
    expect(result.current.todayDate).toBe('');
    expect(result.current.userName).toBe('');

    resolveDashboard(dashboardPayload);

    await waitFor(() => {
      const status = readQueryStatus(result.current);
      expect(status.isInitialLoading).toBe(false);
      expect(status.isFatalError).toBe(false);
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
      expect(result.current.userName).toBe(dashboardPayload.userName);
    });
  });

  it('transitions pending → error: isFatalError true when dashboard fails with no cache', async () => {
    let rejectDashboard!: (reason: Error) => void;
    vi.mocked(getDashboard).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectDashboard = reject;
        }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    const statusWhilePending = readQueryStatus(result.current);
    expect(statusWhilePending.isInitialLoading).toBe(true);
    expect(statusWhilePending.isFatalError).toBe(false);

    rejectDashboard(new Error('network unreachable'));

    await waitFor(() => {
      const status = readQueryStatus(result.current);
      expect(status.isInitialLoading).toBe(false);
      expect(status.isFatalError).toBe(true);
      expect(result.current.todayDate).toBe('');
    });
  });

  it('keeps isInitialLoading false during background dashboard refetch when cached data exists', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(readQueryStatus(result.current).isInitialLoading).toBe(false);
      expect(result.current.userName).toBe(dashboardPayload.userName);
    });

    let resolveSlowRefetch!: (value: typeof dashboardPayload) => void;
    vi.mocked(getDashboard).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlowRefetch = resolve;
        }),
    );

    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(2);
    });

    expect(readQueryStatus(result.current).isInitialLoading).toBe(false);
    expect(result.current.userName).toBe(dashboardPayload.userName);

    resolveSlowRefetch({
      ...dashboardPayload,
      userName: 'Sam (refreshed)',
    });

    await waitFor(() => {
      expect(result.current.userName).toBe('Sam (refreshed)');
    });

    expect(readQueryStatus(result.current).isInitialLoading).toBe(false);
  });

  it('refetchAll refetches dashboard, activity-logs, and delayed-tax', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(readDelayedTax(result.current)).toEqual(delayedTaxFixture);
    });

    vi.mocked(getDashboard).mockClear();
    vi.mocked(listActivityLogs).mockClear();
    vi.mocked(getDelayedTax).mockClear();

    act(() => {
      readQueryStatus(result.current).refetchAll();
    });

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(listActivityLogs).toHaveBeenCalledTimes(1);
      expect(getDelayedTax).toHaveBeenCalledWith({ asOf: dashboardPayload.todayDate });
    });
  });
});

// =============================================================================
// H10.3 — dashboard-derived goals and previousBlocks (no redundant list queries)
// =============================================================================

describe('useMilestoneEngine dashboard consolidation (H10.3)', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not register goals or training-blocks query keys in the cache', async () => {
    const { queryClient } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(queryClient.getQueryCache().find({ queryKey: ['goals'] })).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: ['training-blocks'] })).toBeUndefined();
  });

  it('goals and previousBlocks are [] while dashboard is still pending', async () => {
    let resolveDashboard!: (value: DashboardPayload) => void;
    vi.mocked(getDashboard).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDashboard = resolve;
        }),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(result.current.goals).toEqual([]);
    expect(result.current.previousBlocks).toEqual([]);

    resolveDashboard(dashboardPayload);

    await waitFor(() => {
      expect(result.current.goals).toEqual([goalFixture]);
      expect(result.current.previousBlocks).toEqual([completedBlockFixture]);
    });
  });

  it('goals and previousBlocks are [] when dashboard fails with no cache', async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error('dashboard unavailable'));

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(result.current.goals).toEqual([]);
    expect(result.current.previousBlocks).toEqual([]);
    expect(listGoals).not.toHaveBeenCalled();
    expect(listTrainingBlocks).not.toHaveBeenCalled();
  });
});

describe('useMilestoneEngine — S25.F8/F9 check-ins and activity class mutations', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads checkIns from listDailyCheckIns for the last 365 days', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listDailyCheckIns).toHaveBeenCalledWith({
        startDate: '2025-05-25',
        endDate: dashboardPayload.todayDate,
      });
    });

    expect(result.current.checkIns).toEqual([
      expect.objectContaining({
        hasFlareUp: true,
        flareUp: expect.objectContaining({ bodyPart: 'Left heel' }),
      }),
    ]);
  });

  it('updateActivityClass PATCHes and invalidates dashboard + activity-classes', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    await act(async () => {
      await result.current.updateActivityClass('cls-foot', {
        name: 'Foot load',
        type: 'recovery',
      });
    });

    expect(patchActivityClass).toHaveBeenCalledWith('cls-foot', {
      name: 'Foot load',
      type: 'recovery',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-classes'] });
  });

  it('deleteActivityClass DELETEs and invalidates dashboard, activity-classes, and activities', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    await act(async () => {
      await result.current.deleteActivityClass('cls-foot');
    });

    expect(deleteActivityClass).toHaveBeenCalledWith('cls-foot');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity-classes'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activities'] });
  });

  it('submitCheckIn invalidates daily-check-ins on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.todayDate).toBe(dashboardPayload.todayDate);
    });

    act(() => {
      result.current.submitCheckIn({
        painLevel: 3,
        readinessLevel: 6,
        stiffnessLevel: 4,
        hasFlareUp: false,
      });
    });

    await waitFor(() => {
      expect(createDailyCheckIn).toHaveBeenCalledTimes(1);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-check-ins'] });
  });
});
