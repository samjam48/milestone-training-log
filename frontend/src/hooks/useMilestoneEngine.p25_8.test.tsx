/**
 * P25.8 — Edit Rules: surface API errors on rule create
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: hook exposes rule mutation errors and clears on retry/dismiss.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';

import { ApiError } from '../lib/api/client';
import { renderHookWithProviders } from '../test/renderHookWithProviders';
import {
  useMilestoneEngine,
  type MilestoneEngineResult,
} from './useMilestoneEngine';

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  listActivityLogs: vi.fn(),
  createActivityLog: vi.fn(),
  patchActivityLog: vi.fn(),
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
  listRulesByBlock,
  listWeeklyTargetsByBlock,
  createRule as createRuleApi,
  patchRule,
} from '../lib/api';
import { dashboardReadSnake } from '../lib/api/testFixtures';
import { mapDashboardFromApi, type DashboardPayload } from '../lib/api/mappers';
import type { Rule } from '../types';

const ACTIVE_BLOCK_ID = 'blk-1';

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

function buildDashboardPayload(): DashboardPayload {
  return mapDashboardFromApi(dashboardReadSnake as Record<string, unknown>);
}

type EngineWithRuleMutationError = MilestoneEngineResult & {
  ruleMutationError: string | null;
  clearRuleMutationError: () => void;
};

function readRuleMutationState(engine: MilestoneEngineResult): {
  error: string | null;
  clear: () => void;
} {
  const extended = engine as EngineWithRuleMutationError;
  return {
    error: extended.ruleMutationError ?? null,
    clear: extended.clearRuleMutationError ?? (() => undefined),
  };
}

function setupDefaultApiMocks(): void {
  vi.mocked(getDashboard).mockImplementation(async () => buildDashboardPayload());
  vi.mocked(listActivityLogs).mockResolvedValue([]);
  vi.mocked(listRulesByBlock).mockResolvedValue([ruleFixture]);
  vi.mocked(listWeeklyTargetsByBlock).mockResolvedValue([]);
  vi.mocked(createRuleApi).mockResolvedValue(ruleFixture);
  vi.mocked(patchRule).mockResolvedValue(ruleFixture);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultApiMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMilestoneEngine — P25.8 rule mutation errors', () => {
  it('exposes ApiError message when createRule fails with 409 duplicate', async () => {
    vi.mocked(createRuleApi).mockRejectedValueOnce(
      new ApiError(409, 'Rule already exists'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

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

    await waitFor(() => {
      expect(readRuleMutationState(result.current).error).toBe('Rule already exists');
    });
  });

  it('exposes ApiError message when createRule fails with 422 validation', async () => {
    vi.mocked(createRuleApi).mockRejectedValueOnce(
      new ApiError(422, 'threshold_value must be positive'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createRule({
        activityClassId: 'cls-foot',
        ruleType: 'frequency_limit',
        thresholdValue: 0,
        windowDays: 7,
        enabled: true,
      });
    });

    await waitFor(() => {
      expect(readRuleMutationState(result.current).error).toBe(
        'threshold_value must be positive',
      );
    });
  });

  it('exposes ApiError message when updateRule fails with 422 validation', async () => {
    vi.mocked(patchRule).mockRejectedValueOnce(
      new ApiError(422, 'limit_unit is required for volume cap rules'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.updateRule('rule-rest-foot', { limitUnit: 'km' });
    });

    await waitFor(() => {
      expect(readRuleMutationState(result.current).error).toBe(
        'limit_unit is required for volume cap rules',
      );
    });
  });

  it('clears ruleMutationError when clearRuleMutationError is called', async () => {
    vi.mocked(createRuleApi).mockRejectedValueOnce(
      new ApiError(409, 'Rule already exists'),
    );

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.createRule({
        activityClassId: 'cls-foot',
        ruleType: 'rest_between_class',
        thresholdValue: 2,
        windowDays: 7,
        enabled: true,
      });
    });

    await waitFor(() => {
      expect(readRuleMutationState(result.current).error).toBe('Rule already exists');
    });

    act(() => {
      readRuleMutationState(result.current).clear();
    });

    expect(readRuleMutationState(result.current).error).toBeNull();
  });

  it('clears ruleMutationError after a successful createRule retry', async () => {
    vi.mocked(createRuleApi)
      .mockRejectedValueOnce(new ApiError(409, 'Rule already exists'))
      .mockResolvedValueOnce(ruleFixture);

    const { result } = renderHookWithProviders(() => useMilestoneEngine());

    await waitFor(() => {
      expect(listRulesByBlock).toHaveBeenCalledTimes(1);
    });

    const draft = {
      activityClassId: 'cls-foot',
      ruleType: 'frequency_limit' as const,
      thresholdValue: 3,
      windowDays: 7,
      enabled: true,
    };

    act(() => {
      result.current.createRule(draft);
    });

    await waitFor(() => {
      expect(readRuleMutationState(result.current).error).toBe('Rule already exists');
    });

    act(() => {
      result.current.createRule(draft);
    });

    await waitFor(() => {
      expect(createRuleApi).toHaveBeenCalledTimes(2);
      expect(readRuleMutationState(result.current).error).toBeNull();
    });
  });
});
