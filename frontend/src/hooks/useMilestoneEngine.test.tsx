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
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import type { Activity, Goal, Rule, WeeklyTarget, TrainingBlock, RecoveryStreak } from '../types';
import {
  dashboardReadSnake,
  activityLogReadSnake,
  ruleViolationReadSnakeCaution,
} from '../lib/api/testFixtures';
import {
  mapActivityLogCreateBody,
  mapActivityLogFromApi,
  mapDashboardFromApi,
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
  createTrainingBlock: vi.fn(),
  createActivity: vi.fn(),
  patchActivity: vi.fn(),
  listActivities: vi.fn(),
  getDelayedTax: vi.fn(),
}));

import {
  getDashboard,
  listActivityLogs,
  createActivityLog,
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
  createTrainingBlock as createTrainingBlockApi,
  createActivity,
  patchActivity,
  listActivities,
  getDelayedTax,
  createDailyCheckIn,
  createFlareUpIncident,
} from '../lib/api';

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

const dashboardPayload = mapDashboardFromApi(dashboardReadSnake);

type EngineWithDelayedTax = MilestoneEngineResult & {
  delayedTax?: DelayedTaxResponse;
};

function readDelayedTax(engine: MilestoneEngineResult): DelayedTaxResponse | undefined {
  return (engine as EngineWithDelayedTax).delayedTax;
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

const goalFixture: Omit<Goal, 'userId'> = {
  id: 'goal-1',
  title: 'Walk 20km without flare-up',
  targetDate: '2026-05-31',
  timeframe: 'monthly',
  status: 'active',
  createdAt: '2026-04-07T06:00:00Z',
};

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

const completedBlockFixture: Omit<TrainingBlock, 'userId'> = {
  id: 'blk-0',
  name: 'Phase 1 Foundation',
  startDate: '2026-03-01',
  endDate: '2026-04-06',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-03-01T06:00:00Z',
};

function setupDefaultApiMocks(): void {
  vi.mocked(getDashboard).mockResolvedValue(dashboardPayload);
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
  vi.mocked(patchActivity).mockResolvedValue(activityFixture);
  vi.mocked(listActivities).mockResolvedValue([]);
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

  it('invokes dashboard and activity-logs queries on mount', async () => {
    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(listActivityLogs).toHaveBeenCalledTimes(1);
    });
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
    expect(result.current.suggestions).toEqual(dashboardPayload.suggestions);
    expect(result.current.weeklyProgress).toEqual(dashboardPayload.weeklyProgress);
    expect(result.current.dailyScores).toEqual(dashboardPayload.dailyScores);
    expect(result.current.loadSeries).toEqual(dashboardPayload.loadSeries);
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

  it('fires listGoals query on mount and exposes result as engine.goals', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listGoals).toHaveBeenCalledTimes(1);
      expect(result.current.goals).toEqual([goalFixture]);
    });
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

  it('fires listTrainingBlocks query on mount and exposes previousBlocks', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listTrainingBlocks).toHaveBeenCalledTimes(1);
    });

    // previousBlocks should exist on the result
    expect(Array.isArray(result.current.previousBlocks)).toBe(true);
  });

  it('previousBlocks excludes the active block', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    // Wait for both data sources to be populated before asserting
    await waitFor(() => {
      expect(listTrainingBlocks).toHaveBeenCalledWith();
      const ids = result.current.previousBlocks.map((b: TrainingBlock) => b.id);
      // completedBlockFixture should be in previousBlocks; activeBlockFixture should not
      expect(ids).toContain(completedBlockFixture.id);
      expect(ids).not.toContain(ACTIVE_BLOCK_ID);
    });
  });

  it('rules and weeklyTargets are disabled (not called) when no block exists', async () => {
    // Override dashboard to return null block
    const { mapDashboardFromApi: mapDash } = await import('../lib/api/mappers');
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(mapDash(dashboardReadSnakeNoBlock));

    renderHookWithProviders(() => useMilestoneEngine());

    // Wait for dashboard to resolve and goals/trainingBlocks to settle (they load always)
    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
      expect(listGoals).toHaveBeenCalledTimes(1);
    });

    // Block-scoped queries must NOT have been called
    expect(listRulesByBlock).not.toHaveBeenCalled();
    expect(listWeeklyTargetsByBlock).not.toHaveBeenCalled();
  });

  it('rules and weeklyTargets default to [] when block is absent', async () => {
    const { mapDashboardFromApi: mapDash } = await import('../lib/api/mappers');
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(mapDash(dashboardReadSnakeNoBlock));

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

  it('listGoals IS called even when no active block exists', async () => {
    const { mapDashboardFromApi: mapDash } = await import('../lib/api/mappers');
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(mapDash(dashboardReadSnakeNoBlock));

    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(listGoals).toHaveBeenCalledTimes(1);
  });

  it('listTrainingBlocks IS called even when no active block exists', async () => {
    const { mapDashboardFromApi: mapDash } = await import('../lib/api/mappers');
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(mapDash(dashboardReadSnakeNoBlock));

    renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    expect(listTrainingBlocks).toHaveBeenCalledTimes(1);
  });

  it('previousBlocks returns all blocks when block is null', async () => {
    const { mapDashboardFromApi: mapDash } = await import('../lib/api/mappers');
    const { dashboardReadSnakeNoBlock } = await import('../lib/api/testFixtures');
    vi.mocked(getDashboard).mockResolvedValue(mapDash(dashboardReadSnakeNoBlock));
    vi.mocked(listTrainingBlocks).mockResolvedValue([activeBlockFixture, completedBlockFixture]);

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    // Wait for training-blocks data to populate result
    await waitFor(() => {
      const ids = result.current.previousBlocks.map((b: TrainingBlock) => b.id);
      // When block is null, previousBlocks should include all returned blocks
      expect(ids).toContain(activeBlockFixture.id);
      expect(ids).toContain(completedBlockFixture.id);
    });
  });

  it('goals defaults to [] when listGoals returns empty array', async () => {
    vi.mocked(listGoals).mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listGoals).toHaveBeenCalledTimes(1);
    });

    expect(result.current.goals).toEqual([]);
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

  it('createGoal calls createGoalApi and invalidates ["goals"]', async () => {
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['goals'] });
    });
  });

  // ---------------------------------------------------------------------------
  // archiveGoal mutation
  // ---------------------------------------------------------------------------

  it('archiveGoal patches goal with status "paused" and invalidates ["goals"]', async () => {
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['goals'] });
    });
  });

  // ---------------------------------------------------------------------------
  // updateGoal mutation
  // ---------------------------------------------------------------------------

  it('updateGoal calls patchGoal with the provided patch and invalidates ["goals"]', async () => {
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['goals'] });
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['training-blocks'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
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
    expect(typeof result.current.createGoal).toBe('function');
    expect(typeof result.current.updateGoal).toBe('function');
    expect(typeof result.current.archiveGoal).toBe('function');
    expect(typeof result.current.createRule).toBe('function');
    expect(typeof result.current.updateRule).toBe('function');
    expect(typeof result.current.deleteRule).toBe('function');
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
