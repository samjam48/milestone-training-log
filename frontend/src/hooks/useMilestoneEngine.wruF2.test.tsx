/**
 * WRU.F2 — useMilestoneEngine dead mutation removal (failing first, TDD).
 * plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F2
 *
 * Replaces useMilestoneEngine.wtlF7.test.tsx.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import {
  dashboardReadSnake,
  activityLogReadSnake,
} from '../lib/api/testFixtures';
import {
  mapActivityLogFromApi,
  mapDashboardFromApi,
} from '../lib/api/mappers';
import { renderHookWithProviders } from '../test/renderHookWithProviders';
import {
  useMilestoneEngine,
  type MilestoneEngineResult,
} from './useMilestoneEngine';
import { weeklyFocusBlockSnake } from '../test/wtlF7WeeklyFocusFixtures';
import { WRU_F1_ACTIVE_WEEK } from '../test/wruF1WeeklyRulesFixtures';

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
  createActivity: vi.fn(),
  createActivityClass: vi.fn(),
  patchActivityClass: vi.fn(),
  deleteActivityClass: vi.fn(),
  patchActivity: vi.fn(),
  listActivities: vi.fn(),
  listDailyCheckIns: vi.fn(),
  getDelayedTax: vi.fn(),
  patchTrainingBlock: vi.fn(),
}));

import * as api from '../lib/api';

const { getDashboard, listActivityLogs, listRulesByBlock, listWeeklyTargetsByBlock } = api;

const REMOVED_ENGINE_MUTATIONS = [
  'createTrainingBlock',
  'setupWeeklyFocus',
  'resetWeeklyFocus',
  'patchFocusTitle',
] as const;

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

function setupDefaultApiMocks(): void {
  const snake = {
    ...dashboardReadSnake,
    block: weeklyFocusBlockSnake(WRU_F1_ACTIVE_WEEK),
  };
  vi.mocked(getDashboard).mockImplementation(async () =>
    mapDashboardFromApi(snake as Record<string, unknown>),
  );
  vi.mocked(listActivityLogs).mockResolvedValue([activityLogsListOnlyLog]);
  vi.mocked(listRulesByBlock).mockResolvedValue([]);
  vi.mocked(listWeeklyTargetsByBlock).mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultApiMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMilestoneEngine — WRU.F2 removed block/focus mutations', () => {
  it('does not expose createTrainingBlock, setupWeeklyFocus, resetWeeklyFocus, or patchFocusTitle', async () => {
    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledTimes(1);
    });

    const engine = result.current as MilestoneEngineResult;
    for (const key of REMOVED_ENGINE_MUTATIONS) {
      expect(key in engine).toBe(false);
    }
  });

  it('does not export removed mutations from the trainingBlocks client module', async () => {
    const trainingBlocks = await import('../lib/api/trainingBlocks');
    expect('createTrainingBlock' in trainingBlocks).toBe(false);
    expect('setupWeeklyFocus' in trainingBlocks).toBe(false);
    expect('resetWeeklyFocus' in trainingBlocks).toBe(false);
  });
});
