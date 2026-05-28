/**
 * F1.3 — useMilestoneEngine API rewire acceptance tests.
 *
 * Asserts React Query wiring, dashboard/log field mapping, and mutation payloads
 * serialized through frontend/src/lib/api.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { RecoveryStreak } from '../types';
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
import { useMilestoneEngine } from './useMilestoneEngine';

const MOCK_UUID = '11111111-1111-4111-8111-111111111111';

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  listActivityLogs: vi.fn(),
  createActivityLog: vi.fn(),
  createDailyCheckIn: vi.fn(),
  createFlareUpIncident: vi.fn(),
  checkViolations: vi.fn(),
}));

import {
  getDashboard,
  listActivityLogs,
  createActivityLog,
  checkViolations as checkViolationsApi,
} from '../lib/api';

const activityLogsListOnlyLog = mapActivityLogFromApi({
  ...activityLogReadSnake,
  id: 'log-from-activity-logs-endpoint',
});

const dashboardPayload = mapDashboardFromApi(dashboardReadSnake);

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
