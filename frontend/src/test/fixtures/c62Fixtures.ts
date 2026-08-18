import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, ActivityClass, ActivityLog, RPE } from '../../types';
import { mockEngine } from '../mockEngine';

const CREATED_AT = '2026-04-07T06:00:00Z';
const USER_ID = 'user-1';

export const logActivityClass: ActivityClass = {
  id: 'cls-foot',
  userId: USER_ID,
  name: 'High-Intensity Foot Load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  loadWeight: 1,
  createdAt: CREATED_AT,
};

export const logActivityWalk: Activity = {
  id: 'act-walk',
  userId: USER_ID,
  activityClassId: logActivityClass.id,
  name: 'Morning Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: CREATED_AT,
};

/** Engine stub for Log Activity form tests — walk activity with km volume unit. */
export function createLogActivityEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return {
    ...mockEngine,
    activityClasses: [logActivityClass],
    activities: [logActivityWalk],
    ...overrides,
  };
}

/** Generates many distinct log rows for Log History layout tests. */
export function createManyActivityLogs(count: number): ActivityLog[] {
  return Array.from({ length: count }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    const monthOffset = Math.floor(index / 28);
    const month = String(Math.max(1, 5 - monthOffset)).padStart(2, '0');

    return {
      id: `log-c62-${index}`,
      userId: USER_ID,
      activityId: logActivityWalk.id,
      loggedDate: `2026-${month}-${day}`,
      durationMinutes: 20 + (index % 10),
      volumeValue: 1 + index * 0.1,
      volumeUnit: 'km' as const,
      rpe: ((index % 10) + 1) as RPE,
      postActivityFeel: 'fine' as const,
      createdAt: CREATED_AT,
    };
  });
}

/** Engine stub with a long log history for sticky CTA layout tests. */
export function createLogHistoryEngine(
  logCount = 40,
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return {
    ...mockEngine,
    activityClasses: [logActivityClass],
    activities: [logActivityWalk],
    logs: createManyActivityLogs(logCount),
    ...overrides,
  };
}
