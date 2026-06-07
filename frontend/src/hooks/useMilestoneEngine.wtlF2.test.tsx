/**
 * WTL.F2 — useMilestoneEngine weekly target mutations (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F2
 *
 * Covers activity-scoped create/update/delete mutations and cache invalidation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import type { VolumeUnit, WeeklyTarget } from '../types';
import {
  dashboardReadSnake,
  activityLogReadSnake,
} from '../lib/api/testFixtures';
import {
  mapActivityLogFromApi,
  mapDashboardFromApi,
  mapWeeklyTargetFromApi,
  type DashboardPayload,
} from '../lib/api/mappers';
import { renderHookWithProviders } from '../test/renderHookWithProviders';
import {
  useMilestoneEngine,
  type MilestoneEngineResult,
} from './useMilestoneEngine';
import {
  WTL_F2_ACTIVITY_WALK,
  WTL_F2_WEEKLY_TARGET_WALK,
  type WeeklyTargetWtlF2,
} from '../test/wtlF2WeeklyTargetFixtures';

const ACTIVE_BLOCK_ID = 'blk-1';

/** WTL.B2 activity-scoped draft — not yet on WeeklyTargetDraft. */
type ActivityScopedWeeklyTargetDraft = {
  activityId: string;
  targetValue: number;
  targetUnit: VolumeUnit;
};

function activityScopedDraft(
  draft: ActivityScopedWeeklyTargetDraft,
): Parameters<MilestoneEngineResult['createWeeklyTarget']>[0] {
  return draft as unknown as Parameters<MilestoneEngineResult['createWeeklyTarget']>[0];
}

type WtlF2Engine = MilestoneEngineResult & {
  deleteWeeklyTarget: (targetId: string) => void;
  weeklyTargetMutationError: string | null;
  clearWeeklyTargetMutationError: () => void;
};

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  listActivityLogs: vi.fn(),
  createActivityLog: vi.fn(),
  patchActivityLog: vi.fn(),
  deleteActivityLog: vi.fn(),
  createDailyCheckIn: vi.fn(),
  createFlareUpIncident: vi.fn(),
  checkViolations: vi.fn(),
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
  deleteWeeklyTarget: vi.fn(),
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

import * as api from '../lib/api';

const {
  getDashboard,
  listActivityLogs,
  listWeeklyTargetsByBlock,
  createWeeklyTarget: createWeeklyTargetApi,
  patchWeeklyTarget: patchWeeklyTargetApi,
} = api;

/** WTL.B2 delete API — mocked before export exists on weeklyTargets.ts. */
const deleteWeeklyTargetApi = (
  api as unknown as { deleteWeeklyTarget: ReturnType<typeof vi.fn> }
).deleteWeeklyTarget;

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

function buildDashboardPayload(): DashboardPayload {
  return mapDashboardFromApi(dashboardReadSnake as Record<string, unknown>);
}

const weeklyTargetFixture: WeeklyTargetWtlF2 = {
  ...WTL_F2_WEEKLY_TARGET_WALK,
  trainingBlockId: ACTIVE_BLOCK_ID,
};

function setupDefaultApiMocks(): void {
  vi.mocked(getDashboard).mockImplementation(async () => buildDashboardPayload());
  vi.mocked(listActivityLogs).mockResolvedValue([activityLogsListOnlyLog]);
  vi.mocked(listWeeklyTargetsByBlock).mockResolvedValue([
    mapWeeklyTargetFromApi({
      id: weeklyTargetFixture.id,
      training_block_id: weeklyTargetFixture.trainingBlockId,
      activity_class_id: weeklyTargetFixture.activityClassId,
      activity_id: weeklyTargetFixture.activityId,
      target_value: weeklyTargetFixture.targetValue,
      target_unit: weeklyTargetFixture.targetUnit,
      created_at: weeklyTargetFixture.createdAt,
      updated_at: weeklyTargetFixture.createdAt,
    }),
  ]);
  vi.mocked(createWeeklyTargetApi).mockResolvedValue(weeklyTargetFixture as WeeklyTarget);
  vi.mocked(patchWeeklyTargetApi).mockResolvedValue({
    ...weeklyTargetFixture,
    targetValue: 12,
  } as WeeklyTarget);
  vi.mocked(deleteWeeklyTargetApi).mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultApiMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMilestoneEngine — WTL.F2 weekly target mutations', () => {
  it('exposes deleteWeeklyTarget on the engine result', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    const engine = result.current as WtlF2Engine;
    expect(typeof engine.deleteWeeklyTarget).toBe('function');
  });

  it('weeklyTargets from query include activityId for activity-scoped targets', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(result.current.weeklyTargets.length).toBeGreaterThan(0);
    });

    const target = result.current.weeklyTargets[0] as WeeklyTargetWtlF2;
    expect(target.activityId).toBe(WTL_F2_ACTIVITY_WALK.id);
  });

  it('createWeeklyTarget sends activity-scoped draft with activityId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createWeeklyTarget(
        activityScopedDraft({
          activityId: WTL_F2_ACTIVITY_WALK.id,
          targetValue: 10,
          targetUnit: 'km',
        }),
      );
    });

    await waitFor(() => {
      expect(createWeeklyTargetApi).toHaveBeenCalledTimes(1);
    });

    const [calledBlockId, draft] = vi.mocked(createWeeklyTargetApi).mock.calls[0] ?? [];
    expect(calledBlockId).toBe(ACTIVE_BLOCK_ID);
    expect(draft?.activityId).toBe(WTL_F2_ACTIVITY_WALK.id);
    expect(draft?.activityClassId).toBeUndefined();
    expect(draft?.targetValue).toBe(10);
    expect(draft?.targetUnit).toBe('km');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['weekly-targets', ACTIVE_BLOCK_ID],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
  });

  it('patchWeeklyTarget can move target to another activity with class derivation', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.patchWeeklyTarget(weeklyTargetFixture.id, {
        activityId: 'act-wtl-bike',
        targetValue: 60,
        targetUnit: 'minutes',
      } as Parameters<MilestoneEngineResult['patchWeeklyTarget']>[1]);
    });

    await waitFor(() => {
      expect(patchWeeklyTargetApi).toHaveBeenCalledTimes(1);
    });

    const [targetId, patch] = vi.mocked(patchWeeklyTargetApi).mock.calls[0] ?? [];
    expect(targetId).toBe(weeklyTargetFixture.id);
    expect(patch?.activityId).toBe('act-wtl-bike');
    expect(patch?.targetValue).toBe(60);
    expect(patch?.targetUnit).toBe('minutes');
  });

  it('deleteWeeklyTarget calls deleteWeeklyTargetApi and invalidates weekly targets and dashboard', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const engine = result.current as WtlF2Engine;

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.deleteWeeklyTarget(weeklyTargetFixture.id);
    });

    await waitFor(() => {
      expect(deleteWeeklyTargetApi).toHaveBeenCalledTimes(1);
    });

    const [targetId] = vi.mocked(deleteWeeklyTargetApi).mock.calls[0] ?? [];
    expect(targetId).toBe(weeklyTargetFixture.id);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['weekly-targets', ACTIVE_BLOCK_ID],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    });
  });

  it('surfaces weeklyTargetMutationError when createWeeklyTarget fails with 409', async () => {
    const { ApiError } = await import('../lib/api/client');
    vi.mocked(createWeeklyTargetApi).mockRejectedValueOnce(
      new ApiError(409, 'Weekly target already exists for this activity'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createWeeklyTarget(
        activityScopedDraft({
          activityId: WTL_F2_ACTIVITY_WALK.id,
          targetValue: 8,
          targetUnit: 'km',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.weeklyTargetMutationError).toMatch(
        /weekly target already exists/i,
      );
    });
  });

  it('clearWeeklyTargetMutationError resets weeklyTargetMutationError', async () => {
    const { ApiError } = await import('../lib/api/client');
    vi.mocked(createWeeklyTargetApi).mockRejectedValueOnce(
      new ApiError(409, 'Weekly target already exists for this activity'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listWeeklyTargetsByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createWeeklyTarget(
        activityScopedDraft({
          activityId: WTL_F2_ACTIVITY_WALK.id,
          targetValue: 8,
          targetUnit: 'km',
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.weeklyTargetMutationError).not.toBeNull();
    });

    act(() => {
      result.current.clearWeeklyTargetMutationError();
    });

    expect(result.current.weeklyTargetMutationError).toBeNull();
  });
});
