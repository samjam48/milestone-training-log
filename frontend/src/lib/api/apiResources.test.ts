/**
 * F1.4 — thin resource wrapper coverage for lib/api modules at 0%.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listActivities, createActivity, patchActivity } from './activities';
import { listActivityClasses, createActivityClass } from './activityClasses';
import {
  createActivityLog,
  deleteActivityLog,
  patchActivityLog,
} from './activityLogs';
import { createDailyCheckIn, patchDailyCheckIn } from './dailyCheckIns';
import {
  createFlareUpIncident,
  listFlareUpIncidents,
  patchFlareUpIncident,
} from './flareUpIncidents';
import { createGoal, listGoals } from './goals';
import { getHealth } from './health';
import { createRecoveryTarget, listRecoveryTargetsByBlock } from './recoveryTargets';
import { createRule, listRulesByBlock } from './rules';
import { listTrainingBlocks } from './trainingBlocks';
import { createWeeklyTarget, listWeeklyTargetsByBlock } from './weeklyTargets';
import {
  activityLogReadSnake,
  dailyCheckInReadSnakeNoFlareUp,
} from './testFixtures';
import { ACTIVITIES, ACTIVITY_CLASSES } from '../mockData';

const originalFetch = globalThis.fetch;
const firstActivity = ACTIVITIES[0];
const firstClass = ACTIVITY_CLASSES[0];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('F1.4 api resource wrappers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getHealth fetches /health', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    globalThis.fetch = fetchMock;

    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.any(Object));
  });

  it('listActivities maps snake_case rows', async () => {
    if (!firstActivity) {
      throw new Error('mock activity required');
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: firstActivity.id,
          activity_class_id: firstActivity.activityClassId,
          name: firstActivity.name,
          type: firstActivity.type,
          default_volume_unit: firstActivity.defaultVolumeUnit ?? null,
          is_active: firstActivity.isActive,
          created_at: firstActivity.createdAt,
          updated_at: firstActivity.updatedAt ?? firstActivity.createdAt,
        },
      ]),
    );
    globalThis.fetch = fetchMock;

    const result = await listActivities({ classId: 'cls-foot', isActive: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activities?class_id=cls-foot&is_active=true',
      expect.any(Object),
    );
    expect(result[0]?.id).toBe(firstActivity.id);
  });

  it('createActivity and patchActivity POST/PATCH snake_case bodies', async () => {
    if (!firstActivity) {
      throw new Error('mock activity required');
    }
    const snake = {
      id: firstActivity.id,
      activity_class_id: firstActivity.activityClassId,
      name: firstActivity.name,
      type: firstActivity.type,
      default_volume_unit: null,
      is_active: true,
      created_at: firstActivity.createdAt,
      updated_at: firstActivity.updatedAt ?? firstActivity.createdAt,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(snake))
      .mockResolvedValueOnce(jsonResponse({ ...snake, name: 'Updated walk' }));
    globalThis.fetch = fetchMock;

    await createActivity({
      id: 'act-new',
      activityClassId: 'cls-foot',
      name: 'Walk',
      type: 'endurance',
      isActive: true,
    });
    await patchActivity(firstActivity.id, { name: 'Updated walk' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/activities');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/activities/${firstActivity.id}`);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
  });

  it('listActivityClasses and createActivityClass hit class routes', async () => {
    if (!firstClass) {
      throw new Error('mock class required');
    }
    const snake = {
      id: firstClass.id,
      name: firstClass.name,
      description: null,
      type: firstClass.type,
      default_recovery_window_days: firstClass.defaultRecoveryWindowDays,
      created_at: firstClass.createdAt,
      updated_at: firstClass.updatedAt ?? firstClass.createdAt,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([snake]))
      .mockResolvedValueOnce(jsonResponse(snake));
    globalThis.fetch = fetchMock;

    await listActivityClasses();
    await createActivityClass({
      id: 'cls-new',
      name: 'New class',
      type: 'endurance',
      defaultRecoveryWindowDays: 2,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/activity-classes');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('activity log create, patch, and delete routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(activityLogReadSnake))
      .mockResolvedValueOnce(jsonResponse({ ...activityLogReadSnake, duration_minutes: 30 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock;

    await createActivityLog({
      id: 'log-new',
      activityId: 'act-walk',
      loggedDate: '2026-05-25',
      durationMinutes: 25,
      volumeValue: 2,
    });
    await patchActivityLog('log-1', { durationMinutes: 30 });
    await deleteActivityLog('log-1');

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('daily check-in create and patch routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(dailyCheckInReadSnakeNoFlareUp))
      .mockResolvedValueOnce(jsonResponse({ ...dailyCheckInReadSnakeNoFlareUp, pain_level: 1 }));
    globalThis.fetch = fetchMock;

    await createDailyCheckIn({
      id: 'ci-new',
      checkInDate: '2026-05-28',
      painLevel: 2,
      readinessLevel: 7,
      stiffnessLevel: 3,
      hasFlareUp: false,
    });
    await patchDailyCheckIn('2026-05-28', { painLevel: 1 });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
  });

  it('flare-up incident list, create, and patch routes', async () => {
    const incidentSnake = {
      id: 'inc-1',
      incident_date: '2026-05-25',
      body_part: 'Left heel',
      severity: 7,
      activity_class_id: 'cls-foot',
      daily_check_in_id: null,
      notes: null,
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([incidentSnake]))
      .mockResolvedValueOnce(jsonResponse(incidentSnake))
      .mockResolvedValueOnce(jsonResponse({ ...incidentSnake, severity: 5 }));
    globalThis.fetch = fetchMock;

    await listFlareUpIncidents();
    await createFlareUpIncident({
      id: 'inc-new',
      incidentDate: '2026-05-25',
      bodyPart: 'Left heel',
      severity: 7,
    });
    await patchFlareUpIncident('inc-1', { severity: 5 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/flare-up-incidents');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'PATCH' });
  });

  it('goals, rules, weekly targets, recovery targets, and training blocks routes', async () => {
    const goalSnake = {
      id: 'goal-1',
      title: 'Run 5k',
      description: null,
      target_date: '2026-12-01',
      timeframe: 'medium',
      activity_class_id: null,
      progress_value: null,
      progress_target: null,
      progress_unit: null,
      status: 'active',
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };
    const ruleSnake = {
      id: 'rule-1',
      training_block_id: 'blk-1',
      activity_class_id: 'cls-foot',
      rule_type: 'weekly_load_cap',
      threshold_value: 120,
      window_days: 7,
      enabled: true,
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };
    const weeklyTargetSnake = {
      id: 'wt-1',
      training_block_id: 'blk-1',
      activity_class_id: 'cls-foot',
      target_value: 120,
      target_unit: 'load',
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };
    const recoveryTargetSnake = {
      id: 'rt-1',
      training_block_id: 'blk-1',
      activity_id: 'act-stretch',
      target_frequency: 2,
      frequency_unit: 'daily',
      current_streak_days: 1,
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };
    const blockSnake = {
      id: 'blk-new',
      name: 'Spring block',
      start_date: '2026-05-01',
      end_date: null,
      status: 'active',
      related_goal_id: null,
      notes: null,
      is_review_milestone_hit: false,
      created_at: '2026-05-25T08:00:00Z',
      updated_at: '2026-05-25T08:00:00Z',
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(goalSnake))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(ruleSnake))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(weeklyTargetSnake))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(recoveryTargetSnake))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(blockSnake));
    globalThis.fetch = fetchMock;

    await listGoals();
    await createGoal({
      id: 'goal-1',
      title: 'Run 5k',
      targetDate: '2026-12-01',
      timeframe: 'medium',
      status: 'active',
    });
    await listRulesByBlock('blk-1');
    await createRule('blk-1', {
      id: 'rule-1',
      trainingBlockId: 'blk-1',
      activityClassId: 'cls-foot',
      ruleType: 'weekly_load_cap',
      thresholdValue: 120,
      windowDays: 7,
      enabled: true,
    });
    await listWeeklyTargetsByBlock('blk-1');
    await createWeeklyTarget('blk-1', {
      id: 'wt-1',
      trainingBlockId: 'blk-1',
      activityClassId: 'cls-foot',
      targetValue: 120,
      targetUnit: 'load',
    });
    await listRecoveryTargetsByBlock('blk-1');
    await createRecoveryTarget('blk-1', {
      id: 'rt-1',
      trainingBlockId: 'blk-1',
      activityId: 'act-stretch',
      targetFrequency: 2,
      frequencyUnit: 'daily',
      currentStreakDays: 1,
    });
    await listTrainingBlocks();

    expect(fetchMock).toHaveBeenCalledWith('/api/goals', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/training-blocks/blk-1/rules', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/training-blocks/blk-1/weekly-targets',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/training-blocks/blk-1/recovery-targets',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/training-blocks', expect.any(Object));
  });
});
