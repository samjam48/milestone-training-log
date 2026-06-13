/**
 * UX-A3 — Activity status: this-week sessions + units
 *
 * Tests for the derived `computeClassWeeklySummary` engine function that the
 * implementer must add to `lib/engine.ts` (or an equivalent in
 * `useMilestoneEngine`).
 *
 * These tests FAIL before the UX-A3 implementation exists because
 * `computeClassWeeklySummary` does not yet exist.
 *
 * Acceptance criteria covered:
 *   AC-1  Sessions count derived from Monday–Sunday period matching logs
 *   AC-2  Singular "1 session this week" / plural "3 sessions this week"
 *   AC-3  Zero sessions → "0 sessions this week", no title units
 *   AC-4  Units summed correctly for a single-unit class this week
 *   AC-5  Mixed units in one class this week → session count only, no title units
 *   AC-6  Week boundary is Monday–Sunday (consistent with weeklyProgress)
 *   AC-7  Only logs within the current week period are counted (older logs excluded)
 *
 * Edge-case tests:
 *   EC-1  Log exactly on Monday is included; log exactly on previous Sunday excluded
 *   EC-2  Log exactly on Sunday (last day of week) is included
 *   EC-3  Inactive activities for the class are excluded from the count
 *   EC-4  Logs for activities in OTHER classes do not count toward this class
 */

import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- import will fail until function is exported
import { computeClassWeeklySummary } from '../lib/engine';
import type { Activity, ActivityClass, ActivityLog, ISODate } from '../types';

// ---------------------------------------------------------------------------
// Types expected from the implementation
// ---------------------------------------------------------------------------

// The implementer must export this type from lib/engine.ts alongside the function.
// Shape expected by DashboardScreen tests and this file:
//
//   export interface ClassWeeklySummary {
//     activityClassId: string;
//     sessionCount: number;           // sessions logged in Mon–Sun current week
//     totalVolume: number | null;     // null when zero sessions or mixed units
//     volumeUnit: VolumeUnit | null;  // null when mixed or zero sessions
//   }

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CREATED_AT = '2026-01-01T00:00:00Z';
const USER_ID = 'user-1';

const walkClass: ActivityClass = {
  id: 'cls-walk',
  userId: USER_ID,
  name: 'Gentle walk',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: CREATED_AT,
};

const walkActivity: Activity = {
  id: 'act-walk',
  userId: USER_ID,
  activityClassId: 'cls-walk',
  name: 'Morning walk',
  type: 'recovery',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: CREATED_AT,
};

const otherClass: ActivityClass = {
  id: 'cls-other',
  userId: USER_ID,
  name: 'Strength',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: CREATED_AT,
};

const otherActivity: Activity = {
  id: 'act-other',
  userId: USER_ID,
  activityClassId: 'cls-other',
  name: 'Squats',
  type: 'performance',
  defaultVolumeUnit: 'reps',
  isActive: true,
  createdAt: CREATED_AT,
};

function makeLog(
  id: string,
  activityId: string,
  loggedDate: ISODate,
  volumeValue: number,
  volumeUnit: ActivityLog['volumeUnit'] = 'km',
): ActivityLog {
  return {
    id,
    userId: USER_ID,
    activityId,
    loggedDate,
    durationMinutes: 30,
    volumeValue,
    volumeUnit,
    createdAt: CREATED_AT,
  };
}

// Week containing 2026-06-12 (a Thursday): Mon 2026-06-08 → Sun 2026-06-14
const THIS_MONDAY: ISODate = '2026-06-08';
const THIS_SUNDAY: ISODate = '2026-06-14';
const LAST_SUNDAY: ISODate = '2026-06-07'; // day before Monday = prior week

// ---------------------------------------------------------------------------
// AC-1  Sessions count derived from Monday–Sunday period matching logs
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-1: session count from Mon–Sun period', () => {
  it('returns session count matching the number of logs in the current week', () => {
    const logs: ActivityLog[] = [
      makeLog('log-1', walkActivity.id, '2026-06-09', 3),
      makeLog('log-2', walkActivity.id, '2026-06-11', 2),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id);
    expect(row).toBeDefined();
    expect(row!.sessionCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-2  Singular / plural: "1 session this week" vs "3 sessions this week"
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-2: singular/plural session count', () => {
  it('returns sessionCount of 1 for a class with exactly one log this week', () => {
    const logs: ActivityLog[] = [makeLog('log-1', walkActivity.id, '2026-06-10', 4)];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id);
    expect(row!.sessionCount).toBe(1);
  });

  it('returns sessionCount of 3 for a class with three logs this week', () => {
    const logs: ActivityLog[] = [
      makeLog('log-1', walkActivity.id, '2026-06-08', 2),
      makeLog('log-2', walkActivity.id, '2026-06-10', 3),
      makeLog('log-3', walkActivity.id, '2026-06-12', 4),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results.find(r => r.activityClassId === walkClass.id)!.sessionCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC-3  Zero sessions → sessionCount 0, totalVolume null, volumeUnit null
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-3: zero sessions this week', () => {
  it('returns sessionCount 0 and null volume fields when no logs exist this week', () => {
    const logs: ActivityLog[] = []; // no logs at all

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id);
    expect(row!.sessionCount).toBe(0);
    expect(row!.totalVolume).toBeNull();
    expect(row!.volumeUnit).toBeNull();
  });

  it('returns sessionCount 0 when all logs are from before the current week', () => {
    const logs: ActivityLog[] = [
      makeLog('log-old', walkActivity.id, LAST_SUNDAY, 5), // prior week
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results.find(r => r.activityClassId === walkClass.id)!.sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4  Units summed for a single-unit class
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-4: single-unit volume sum', () => {
  it('sums volume correctly when all week logs share the same unit', () => {
    const logs: ActivityLog[] = [
      makeLog('log-1', walkActivity.id, '2026-06-09', 3, 'km'),
      makeLog('log-2', walkActivity.id, '2026-06-11', 2, 'km'),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id);
    expect(row!.totalVolume).toBe(5);
    expect(row!.volumeUnit).toBe('km');
  });

  it('rounds volume to one decimal place (no trailing .0 when integer)', () => {
    const logs: ActivityLog[] = [
      makeLog('log-1', walkActivity.id, '2026-06-09', 2.5, 'km'),
      makeLog('log-2', walkActivity.id, '2026-06-10', 2.5, 'km'),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id)!;
    // 5.0 should round to 5, not "5.0"
    expect(row.totalVolume).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// AC-5  Mixed units → session count only, totalVolume null, volumeUnit null
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-5: mixed units in one class', () => {
  const minuteActivity: Activity = {
    id: 'act-walk-min',
    userId: USER_ID,
    activityClassId: 'cls-walk',
    name: 'Pool walk',
    type: 'recovery',
    defaultVolumeUnit: 'minutes',
    isActive: true,
    createdAt: CREATED_AT,
  };

  it('returns null totalVolume when logs for the same class use different units this week', () => {
    const logs: ActivityLog[] = [
      makeLog('log-1', walkActivity.id, '2026-06-09', 3, 'km'),
      makeLog('log-2', minuteActivity.id, '2026-06-10', 30, 'minutes'),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity, minuteActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id)!;
    expect(row.sessionCount).toBe(2); // both sessions still counted
    expect(row.totalVolume).toBeNull();
    expect(row.volumeUnit).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-6  Week boundary is Monday–Sunday (same period as weeklyProgress)
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — AC-6: Monday–Sunday week boundary', () => {
  it('excludes a log dated the Sunday before the week (prior week)', () => {
    const logs: ActivityLog[] = [
      makeLog('log-prev', walkActivity.id, LAST_SUNDAY, 5, 'km'), // prior week
      makeLog('log-curr', walkActivity.id, THIS_MONDAY, 3, 'km'), // this week
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id)!;
    expect(row.sessionCount).toBe(1); // only the Monday log
    expect(row.totalVolume).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// EC-1  Log on Monday is included; log on prior Sunday is excluded
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — EC-1: boundary dates (inclusive)', () => {
  it('includes a log exactly on Monday', () => {
    const logs: ActivityLog[] = [makeLog('log-monday', walkActivity.id, THIS_MONDAY, 4, 'km')];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results.find(r => r.activityClassId === walkClass.id)!.sessionCount).toBe(1);
  });

  it('excludes a log on the Sunday immediately before Monday (prior week)', () => {
    const logs: ActivityLog[] = [makeLog('log-prior-sun', walkActivity.id, LAST_SUNDAY, 4, 'km')];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results.find(r => r.activityClassId === walkClass.id)!.sessionCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// EC-2  Log on Sunday (last day of week) is included
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — EC-2: Sunday is the last day of the week', () => {
  it('includes a log dated on Sunday of the current week', () => {
    const logs: ActivityLog[] = [makeLog('log-sun', walkActivity.id, THIS_SUNDAY, 2, 'km')];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results.find(r => r.activityClassId === walkClass.id)!.sessionCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// EC-3  Inactive activities are excluded
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — EC-3: inactive activities excluded', () => {
  it('does not count logs for inactive activities toward the class session count', () => {
    const inactiveActivity: Activity = {
      id: 'act-inactive',
      userId: USER_ID,
      activityClassId: 'cls-walk',
      name: 'Retired walk',
      type: 'recovery',
      defaultVolumeUnit: 'km',
      isActive: false, // inactive
      createdAt: CREATED_AT,
    };

    const logs: ActivityLog[] = [
      makeLog('log-active', walkActivity.id, '2026-06-10', 3, 'km'),
      makeLog('log-inactive', inactiveActivity.id, '2026-06-11', 5, 'km'),
    ];

    const results = computeClassWeeklySummary(
      [walkClass],
      [walkActivity, inactiveActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const row = results.find(r => r.activityClassId === walkClass.id)!;
    expect(row.sessionCount).toBe(1); // only the active activity log
    expect(row.totalVolume).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// EC-4  Logs for other classes do not count toward this class
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — EC-4: logs for other classes excluded', () => {
  it('does not include logs from a different class in this class session count', () => {
    const logs: ActivityLog[] = [
      makeLog('log-walk', walkActivity.id, '2026-06-10', 3, 'km'),
      makeLog('log-other', otherActivity.id, '2026-06-10', 10, 'reps'),
    ];

    const results = computeClassWeeklySummary(
      [walkClass, otherClass],
      [walkActivity, otherActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    const walkRow = results.find(r => r.activityClassId === walkClass.id)!;
    expect(walkRow.sessionCount).toBe(1);
    expect(walkRow.totalVolume).toBe(3);
    expect(walkRow.volumeUnit).toBe('km');

    const otherRow = results.find(r => r.activityClassId === otherClass.id)!;
    expect(otherRow.sessionCount).toBe(1);
    expect(otherRow.volumeUnit).toBe('reps');
  });
});

// ---------------------------------------------------------------------------
// Return shape — one entry per class in the input list
// ---------------------------------------------------------------------------

describe('computeClassWeeklySummary — return shape', () => {
  it('returns exactly one entry per activity class, in the same order', () => {
    const logs: ActivityLog[] = [];

    const results = computeClassWeeklySummary(
      [walkClass, otherClass],
      [walkActivity, otherActivity],
      logs,
      THIS_MONDAY,
      THIS_SUNDAY,
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.activityClassId).toBe(walkClass.id);
    expect(results[1]!.activityClassId).toBe(otherClass.id);
  });
});
