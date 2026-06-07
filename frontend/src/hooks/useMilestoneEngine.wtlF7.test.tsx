/**
 * WTL.F7 — useMilestoneEngine weekly focus mutations (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F7
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import {
  dashboardReadSnake,
  activityLogReadSnake,
} from '../lib/api/testFixtures';
import {
  mapActivityLogFromApi,
  mapDashboardFromApi,
  mapTrainingBlockFromApi,
  type DashboardPayload,
} from '../lib/api/mappers';
import { renderHookWithProviders } from '../test/renderHookWithProviders';
import {
  useMilestoneEngine,
  type MilestoneEngineResult,
} from './useMilestoneEngine';
import {
  WTL_F7_ACTIVE_WEEKLY_FOCUS,
  WTL_F7_RESET_FOCUS_BLOCK,
  weeklyFocusBlockSnake,
} from '../test/wtlF7WeeklyFocusFixtures';

const ACTIVE_BLOCK_ID = 'blk-wf-active';

type WtlF7Engine = MilestoneEngineResult & {
  setupWeeklyFocus: (focusTitle: string) => void;
  resetWeeklyFocus: (focusTitle: string) => void;
  patchFocusTitle: (focusTitle: string) => void;
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
  setupWeeklyFocus: vi.fn(),
  resetWeeklyFocus: vi.fn(),
  patchTrainingBlock: vi.fn(),
}));

import * as api from '../lib/api';

const {
  getDashboard,
  listActivityLogs,
  listRulesByBlock,
  listWeeklyTargetsByBlock,
} = api;

const setupWeeklyFocusApi = (
  api as unknown as { setupWeeklyFocus: ReturnType<typeof vi.fn> }
).setupWeeklyFocus;

const resetWeeklyFocusApi = (
  api as unknown as { resetWeeklyFocus: ReturnType<typeof vi.fn> }
).resetWeeklyFocus;

const patchTrainingBlockApi = (
  api as unknown as { patchTrainingBlock: ReturnType<typeof vi.fn> }
).patchTrainingBlock;

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

function buildDashboardPayload(): DashboardPayload {
  const snake = {
    ...dashboardReadSnake,
    block: weeklyFocusBlockSnake(WTL_F7_ACTIVE_WEEKLY_FOCUS),
  };
  return mapDashboardFromApi(snake as Record<string, unknown>);
}

function setupDefaultApiMocks(): void {
  vi.mocked(getDashboard).mockImplementation(async () => buildDashboardPayload());
  vi.mocked(listActivityLogs).mockResolvedValue([activityLogsListOnlyLog]);
  vi.mocked(listRulesByBlock).mockResolvedValue([]);
  vi.mocked(listWeeklyTargetsByBlock).mockResolvedValue([]);
  vi.mocked(setupWeeklyFocusApi).mockResolvedValue(
    mapTrainingBlockFromApi(weeklyFocusBlockSnake(WTL_F7_RESET_FOCUS_BLOCK)),
  );
  vi.mocked(resetWeeklyFocusApi).mockResolvedValue(
    mapTrainingBlockFromApi(weeklyFocusBlockSnake(WTL_F7_RESET_FOCUS_BLOCK)),
  );
  vi.mocked(patchTrainingBlockApi).mockResolvedValue(
    mapTrainingBlockFromApi({
      ...weeklyFocusBlockSnake(WTL_F7_ACTIVE_WEEKLY_FOCUS),
      focus_title: 'Stronger ankles',
      name: 'Stronger ankles · Week 3',
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultApiMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMilestoneEngine — WTL.F7 weekly focus mutations', () => {
  it('exposes setupWeeklyFocus, resetWeeklyFocus, and patchFocusTitle', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    const engine = result.current as WtlF7Engine;
    expect(typeof engine.setupWeeklyFocus).toBe('function');
    expect(typeof engine.resetWeeklyFocus).toBe('function');
    expect(typeof engine.patchFocusTitle).toBe('function');
  });

  it('setupWeeklyFocus calls setupWeeklyFocusApi with focusTitle', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.setupWeeklyFocus('First weekly focus');
    });

    await waitFor(() => {
      expect(setupWeeklyFocusApi).toHaveBeenCalledTimes(1);
    });
    expect(setupWeeklyFocusApi).toHaveBeenCalledWith({
      focusTitle: 'First weekly focus',
    });
  });

  it('resetWeeklyFocus calls resetWeeklyFocusApi with focusTitle', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.resetWeeklyFocus('Build running base');
    });

    await waitFor(() => {
      expect(resetWeeklyFocusApi).toHaveBeenCalledTimes(1);
    });
    expect(resetWeeklyFocusApi).toHaveBeenCalledWith({
      focusTitle: 'Build running base',
    });
  });

  it('patchFocusTitle PATCHes the active block focus title', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.patchFocusTitle('Stronger ankles');
    });

    await waitFor(() => {
      expect(patchTrainingBlockApi).toHaveBeenCalledTimes(1);
    });

    const [blockId, patch] = vi.mocked(patchTrainingBlockApi).mock.calls[0] ?? [];
    expect(blockId).toBe(ACTIVE_BLOCK_ID);
    expect(patch?.focusTitle).toBe('Stronger ankles');
  });

  it('setupWeeklyFocus invalidates dashboard and training-blocks queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.setupWeeklyFocus('First weekly focus');
    });

    await waitFor(() => {
      expect(setupWeeklyFocusApi).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['training-blocks'] });
    });
  });

  it('resetWeeklyFocus invalidates dashboard and training-blocks queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.resetWeeklyFocus('Build running base');
    });

    await waitFor(() => {
      expect(resetWeeklyFocusApi).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['training-blocks'] });
    });
  });

  it('patchFocusTitle invalidates dashboard and training-blocks queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMilestoneEngine());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const engine = result.current as WtlF7Engine;

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    act(() => {
      engine.patchFocusTitle('Stronger ankles');
    });

    await waitFor(() => {
      expect(patchTrainingBlockApi).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['training-blocks'] });
    });
  });
});
