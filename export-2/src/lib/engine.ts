// =============================================================================
// engine.ts — Tier 4 rules engine (pure functions, no React)
// -----------------------------------------------------------------------------
// Computes all derived state needed by Tier-3 screens from raw stored data.
// Every export here is a pure function; nothing mutates, nothing renders.
//
// Computed shapes defined here (not in types.ts) because they are never
// stored — they are ephemeral outputs of the engine, recalculated on demand.
// =============================================================================

import type {
  ActivityClass, Activity, ActivityLog, DailyCheckIn,
  FlareUpIncident, Rule, WeeklyTarget,
  ActivityClassStatus, DailySafetyScore, SafetyState, ID, ISODate, VolumeUnit,
} from '../types';
import {
  parseISODate, addDays, eachDay,
  rollingLoad, buildLoadSeries, LoadPoint,
} from './load';

// ---------------------------------------------------------------------------
// Computed output shapes (engine-layer types, not stored)
// ---------------------------------------------------------------------------

export interface WeeklyProgress {
  weeklyTargetId: ID;
  activityClassId: ID;
  className: string;
  value: number;
  target: number;
  unit: VolumeUnit | 'sessions';
  state: SafetyState | 'neutral';
}

/** A suggestion the engine produces for "what to do today". */
export interface Suggestion {
  id: ID;
  label: string;
  state: SafetyState;
  reason: string;
  nextSafeDate?: ISODate;
  lastDoneDate?: ISODate;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Day difference: positive = `to` is later. */
function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round(
    (parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000,
  );
}

function activityIdsForClass(classId: ID, activities: Activity[]): ID[] {
  return activities.filter(a => a.activityClassId === classId && a.isActive).map(a => a.id);
}

function logsForClass(classId: ID, activities: Activity[], logs: ActivityLog[]): ActivityLog[] {
  const ids = activityIdsForClass(classId, activities);
  return logs.filter(l => ids.includes(l.activityId));
}

// ---------------------------------------------------------------------------
// computeClassStatuses
// ---------------------------------------------------------------------------

export function computeClassStatuses(
  asOf: ISODate,
  activityClasses: ActivityClass[],
  activities: Activity[],
  logs: ActivityLog[],
  rules: Rule[],
): ActivityClassStatus[] {
  return activityClasses.map(cls => {
    const classLogs = logsForClass(cls.id, activities, logs)
      .filter(l => l.loggedDate <= asOf)
      .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));

    const lastLog = classLogs[0];
    const lastDoneDate = lastLog?.loggedDate;

    const restRule = rules.find(
      r => r.activityClassId === cls.id && r.ruleType === 'rest_between_class' && r.enabled,
    );
    const loadCapRule = rules.find(
      r => r.activityClassId === cls.id && r.ruleType === 'weekly_load_cap' && r.enabled,
    );

    // No history → trivially safe
    if (!lastDoneDate) {
      return { activityClassId: cls.id, state: 'safe', label: 'Safe', reason: 'No prior sessions — safe to begin.' };
    }

    const daysSince = daysBetween(lastDoneDate, asOf);

    // Load-cap check (higher priority than rest check)
    if (loadCapRule) {
      const curLoad = rollingLoad(classLogs, asOf, loadCapRule.windowDays);
      if (curLoad >= loadCapRule.thresholdValue) {
        return {
          activityClassId: cls.id, state: 'danger', label: 'Load Cap Hit', lastDoneDate,
          reason: `7-day load ${Math.round(curLoad)} of ${loadCapRule.thresholdValue} cap — rest this class.`,
        };
      }
    }

    // No rest rule → always safe after any gap
    if (!restRule) {
      return {
        activityClassId: cls.id, state: 'safe', label: 'Safe', lastDoneDate,
        reason: daysSince === 1 ? 'Last done yesterday — no rest rule for this class.' : `Last done ${daysSince} days ago.`,
      };
    }

    const threshold = restRule.thresholdValue;
    const nextSafeDate = addDays(lastDoneDate, threshold + 1);
    const daysLeft = threshold - daysSince;

    if (daysSince > threshold) {
      return {
        activityClassId: cls.id, state: 'safe', label: 'Safe', lastDoneDate,
        reason: `Fully rested — ${daysSince} days since last session.`,
      };
    }
    if (daysSince <= 1) {
      return {
        activityClassId: cls.id, state: 'danger', label: 'Resting', lastDoneDate, nextSafeDate,
        reason: `Too soon — ${daysLeft + 1} more rest day${daysLeft + 1 === 1 ? '' : 's'} needed. Safe from ${nextSafeDate}.`,
      };
    }
    return {
      activityClassId: cls.id, state: 'caution', label: 'Pushing it', lastDoneDate, nextSafeDate,
      reason: `${daysLeft} more rest day${daysLeft === 1 ? '' : 's'} recommended. Safe from ${nextSafeDate}.`,
    };
  });
}

// ---------------------------------------------------------------------------
// computeDailySafetyScores
// ---------------------------------------------------------------------------

export function computeDailySafetyScores(
  startDate: ISODate,
  endDate: ISODate,
  logs: ActivityLog[],
  checkIns: DailyCheckIn[],
  incidents: FlareUpIncident[],
): DailySafetyScore[] {
  const logsByDate = new Map<ISODate, ActivityLog[]>();
  for (const l of logs) {
    if (!logsByDate.has(l.loggedDate)) logsByDate.set(l.loggedDate, []);
    logsByDate.get(l.loggedDate)!.push(l);
  }
  const checkInByDate = new Map(checkIns.map(c => [c.checkInDate, c]));
  const incidentByDate = new Map(incidents.map(i => [i.incidentDate, i]));

  return eachDay(startDate, endDate).map(date => {
    const dayLogs = logsByDate.get(date) ?? [];
    const checkIn = checkInByDate.get(date);
    const incident = incidentByDate.get(date);

    const hadFlareUp = !!(incident || checkIn?.hasFlareUp);
    const violations = dayLogs.flatMap(l => l.ruleViolationsAtLog ?? []);

    let state: SafetyState | 'neutral';
    if (dayLogs.length === 0 && !checkIn && !incident) {
      state = 'neutral';
    } else if (hadFlareUp || dayLogs.some(l => l.postActivityFeel === 'bad') || violations.some(v => v.severity === 'danger')) {
      state = 'danger';
    } else if (dayLogs.some(l => l.postActivityFeel === 'mild_discomfort') || violations.some(v => v.severity === 'caution')) {
      state = 'caution';
    } else {
      state = 'safe';
    }

    return { date, state, violations, hadFlareUp, painLevel: checkIn?.painLevel };
  });
}

// ---------------------------------------------------------------------------
// computeSuggestions
// ---------------------------------------------------------------------------

export function computeSuggestions(
  classStatuses: ActivityClassStatus[],
  activities: Activity[],
  activityClasses: ActivityClass[],
): Suggestion[] {
  const statusMap = new Map(classStatuses.map(s => [s.activityClassId, s]));
  const classMap = new Map(activityClasses.map(c => [c.id, c]));

  return activities
    .filter(a => a.isActive)
    .map(a => {
      const status = statusMap.get(a.activityClassId);
      const cls = classMap.get(a.activityClassId);
      return {
        id: a.id,
        label: a.name,
        state: (status?.state ?? 'safe') as SafetyState,
        reason: status?.reason ?? `Ready — ${cls?.name ?? 'this class'} has no active restrictions.`,
        nextSafeDate: status?.nextSafeDate,
        lastDoneDate: status?.lastDoneDate,
      };
    });
}

// ---------------------------------------------------------------------------
// computeWeeklyProgress
// ---------------------------------------------------------------------------

export function computeWeeklyProgress(
  weeklyTargets: WeeklyTarget[],
  activityClasses: ActivityClass[],
  activities: Activity[],
  logs: ActivityLog[],
  periodStart: ISODate,
  periodEnd: ISODate,
): WeeklyProgress[] {
  const classMap = new Map(activityClasses.map(c => [c.id, c]));

  return weeklyTargets.map(wt => {
    const clsActivityIds = activityIdsForClass(wt.activityClassId, activities);
    const periodLogs = logs.filter(
      l => clsActivityIds.includes(l.activityId) && l.loggedDate >= periodStart && l.loggedDate <= periodEnd,
    );

    const value =
      wt.targetUnit === 'sessions'
        ? periodLogs.length
        : periodLogs
            .filter(l => l.volumeUnit === wt.targetUnit)
            .reduce((sum, l) => sum + l.volumeValue, 0);

    const rounded = Math.round(value * 10) / 10;
    const ratio = wt.targetValue > 0 ? rounded / wt.targetValue : 0;
    const state: SafetyState | 'neutral' =
      rounded === 0 ? 'neutral'
      : ratio >= 1.5 ? 'danger'
      : ratio >= 1.2 ? 'caution'
      : 'safe';

    return {
      weeklyTargetId: wt.id,
      activityClassId: wt.activityClassId,
      className: classMap.get(wt.activityClassId)?.name ?? 'Unknown',
      value: rounded,
      target: wt.targetValue,
      unit: wt.targetUnit as VolumeUnit | 'sessions',
      state,
    };
  });
}

// ---------------------------------------------------------------------------
// computeCleanStreak — consecutive sessions with no danger violation or bad feel
// ---------------------------------------------------------------------------

export function computeCleanStreak(logs: ActivityLog[]): number {
  const sorted = [...logs].sort((a, b) => b.loggedDate.localeCompare(a.loggedDate));
  let streak = 0;
  for (const log of sorted) {
    const isDirty =
      log.postActivityFeel === 'bad' ||
      (log.ruleViolationsAtLog?.some(v => v.severity === 'danger') ?? false);
    if (isDirty) break;
    streak++;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// computeLoadSeries — convenience wrapper scoped to a class
// ---------------------------------------------------------------------------

export function computeLoadSeries(
  classId: ID,
  activities: Activity[],
  logs: ActivityLog[],
  startDate: ISODate,
  endDate: ISODate,
  windowDays = 7,
): LoadPoint[] {
  const ids = activityIdsForClass(classId, activities);
  return buildLoadSeries(logs, startDate, endDate, windowDays, l => ids.includes(l.activityId));
}
