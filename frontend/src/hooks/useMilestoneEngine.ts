// =============================================================================
// useMilestoneEngine — Tier 4 mock hook
// -----------------------------------------------------------------------------
// Wires the seed data (lib/mockData) through the rules engine (lib/engine) and
// exposes a fully-reactive state object to Tier-3 screens.
//
// All "writes" (submitCheckIn, submitLog) update local React state; derived
// values are recomputed via useMemo on every change. There is no persistence
// beyond the session — this is the mock implementation for the prototype.
// The real implementation will swap useState for a local-first DB (e.g. SQLite
// via expo-sqlite) without changing any screen code.
// =============================================================================

import * as React from 'react';
import type {
  ActivityLog, DailyCheckIn, FlareUpIncident,
  ActivityClassStatus, DailySafetyScore,
  Score0to10, RPE, PostActivityFeel, VolumeUnit, ISODate, ID,
  RuleViolationSnapshot,
} from '../types';
import {
  TODAY, PERIOD_START, USER_ID, USER_NAME,
  BLOCK, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES,
  WEEKLY_TARGETS, CHECK_INS, INCIDENTS,
} from '../lib/mockData';
import { parseISODate, addDays, DEFAULT_RPE } from '../lib/load';
import {
  computeClassStatuses, computeDailySafetyScores,
  computeSuggestions, computeWeeklyProgress,
  computeCleanStreak, computeLoadSeries,
  WeeklyProgress, Suggestion,
} from '../lib/engine';
import type { LoadPoint } from '../lib/load';

// ---------------------------------------------------------------------------
// Mutation drafts — what screens pass to the hook
// ---------------------------------------------------------------------------

export interface CheckInDraft {
  painLevel: Score0to10;
  readinessLevel: Score0to10;
  stiffnessLevel: Score0to10;
  hasFlareUp: boolean;
  flareUpBodyPart?: string;
  flareUpSeverity?: Score0to10;
  notes?: string;
}

export interface LogDraft {
  activityId: string;
  durationMinutes: number;
  volumeValue: number;
  volumeUnit?: VolumeUnit;
  rpe?: RPE;
  postActivityFeel?: PostActivityFeel;
  notes?: string;
  /** Violations detected at submit time — stored on the log for history display. */
  ruleViolationsAtLog?: RuleViolationSnapshot[];
}

export interface IncidentDraft {
  bodyPart: string;
  severity: Score0to10;
  activityClassId?: ID;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface MilestoneEngineResult {
  // Identity
  todayDate: ISODate;
  userName: string;
  // Block
  block: typeof BLOCK;
  // Raw data (screens may need these for ad-hoc renders)
  activityClasses: typeof ACTIVITY_CLASSES;
  activities: typeof ACTIVITIES;
  logs: ActivityLog[];
  incidents: FlareUpIncident[];
  // Derived
  hasCheckedInToday: boolean;
  classStatuses: ActivityClassStatus[];
  suggestions: Suggestion[];
  weeklyProgress: WeeklyProgress[];
  dailyScores: DailySafetyScore[];
  loadSeries: LoadPoint[];
  flareUpDates: ISODate[];
  weekLoadThreshold: number;
  cleanStreak: number;
  // Mutations
  submitCheckIn: (draft: CheckInDraft) => void;
  submitLog: (draft: LogDraft) => void;
  submitIncident: (draft: IncidentDraft) => void;
  /** Live rule check — call with draft inputs; returns violations without side-effects. */
  checkViolations: (activityId: ID, volumeValue: number, rpe: number) => RuleViolationSnapshot[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let logCounter = 100; // Monotonic id for new mock logs
let ciCounter = 100;
let incCounter = 100;

export function useMilestoneEngine(): MilestoneEngineResult {
  const [logs, setLogs] = React.useState<ActivityLog[]>(LOGS);
  const [checkIns, setCheckIns] = React.useState<DailyCheckIn[]>(CHECK_INS);
  const [incidents, setIncidents] = React.useState<FlareUpIncident[]>(INCIDENTS);

  const hasCheckedInToday = React.useMemo(
    () => checkIns.some(c => c.checkInDate === TODAY),
    [checkIns],
  );

  const classStatuses = React.useMemo(
    () => computeClassStatuses(TODAY, ACTIVITY_CLASSES, ACTIVITIES, logs, RULES),
    [logs],
  );

  const suggestions = React.useMemo(
    () => computeSuggestions(classStatuses, ACTIVITIES, ACTIVITY_CLASSES),
    [classStatuses],
  );

  const weeklyProgress = React.useMemo(
    () => computeWeeklyProgress(WEEKLY_TARGETS, ACTIVITY_CLASSES, ACTIVITIES, logs, PERIOD_START, TODAY),
    [logs],
  );

  const dailyScores = React.useMemo(
    () => computeDailySafetyScores(BLOCK.startDate, TODAY, logs, checkIns, incidents),
    [logs, checkIns, incidents],
  );

  const loadSeries = React.useMemo(
    () => computeLoadSeries('cls-foot', ACTIVITIES, logs, BLOCK.startDate, TODAY),
    [logs],
  );

  const flareUpDates = React.useMemo(
    () => incidents.map(i => i.incidentDate),
    [incidents],
  );

  const weekLoadThreshold = RULES.find(
    r => r.activityClassId === 'cls-foot' && r.ruleType === 'weekly_load_cap',
  )?.thresholdValue ?? 120;

  const cleanStreak = React.useMemo(() => computeCleanStreak(logs), [logs]);

  const submitCheckIn = React.useCallback((draft: CheckInDraft) => {
    const now = new Date().toISOString();
    const newCi: DailyCheckIn = {
      id: `ci-${ciCounter++}`, userId: USER_ID,
      checkInDate: TODAY,
      painLevel: draft.painLevel,
      readinessLevel: draft.readinessLevel,
      stiffnessLevel: draft.stiffnessLevel,
      hasFlareUp: draft.hasFlareUp,
      flareUp: draft.hasFlareUp ? {
        bodyPart: draft.flareUpBodyPart ?? 'Unknown',
        severity: draft.flareUpSeverity ?? 5,
        likelyCauseActivityClassIds: [],
      } : undefined,
      notes: draft.notes,
      createdAt: now,
    };
    setCheckIns(prev => [...prev, newCi]);

    if (draft.hasFlareUp) {
      const newInc: FlareUpIncident = {
        id: `inc-${incCounter++}`, userId: USER_ID,
        incidentDate: TODAY,
        bodyPart: draft.flareUpBodyPart ?? 'Unknown',
        severity: draft.flareUpSeverity ?? 5,
        dailyCheckInId: newCi.id,
        createdAt: now,
      };
      setIncidents(prev => [...prev, newInc]);
    }
  }, []);

  const submitLog = React.useCallback((draft: LogDraft) => {
    const now = new Date().toISOString();
    const newLog: ActivityLog = {
      id: `log-${logCounter++}`, userId: USER_ID,
      activityId: draft.activityId,
      loggedDate: TODAY,
      durationMinutes: draft.durationMinutes,
      volumeValue: draft.volumeValue,
      volumeUnit: draft.volumeUnit,
      rpe: draft.rpe,
      postActivityFeel: draft.postActivityFeel,
      notes: draft.notes,
      ruleViolationsAtLog: draft.ruleViolationsAtLog,
      createdAt: now,
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  const submitIncident = React.useCallback((draft: IncidentDraft) => {
    setIncidents(prev => [...prev, {
      id: `inc-${incCounter++}`, userId: USER_ID,
      incidentDate: TODAY,
      bodyPart: draft.bodyPart,
      severity: draft.severity,
      activityClassId: draft.activityClassId,
      notes: draft.notes,
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  const checkViolations = React.useCallback((
    activityId: ID, volumeValue: number, rpe: number,
  ): RuleViolationSnapshot[] => {
    const activity = ACTIVITIES.find(a => a.id === activityId);
    if (!activity) return [];
    const clsIds = ACTIVITIES.filter(a => a.activityClassId === activity.activityClassId).map(a => a.id);
    const result: RuleViolationSnapshot[] = [];

    const restRule = RULES.find(
      r => r.activityClassId === activity.activityClassId && r.ruleType === 'rest_between_class' && r.enabled,
    );
    if (restRule) {
      const last = [...logs]
        .filter(l => clsIds.includes(l.activityId) && l.loggedDate < TODAY)
        .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
      if (last) {
        const daysSince = Math.round(
          (parseISODate(TODAY).getTime() - parseISODate(last.loggedDate).getTime()) / 86_400_000,
        );
        if (daysSince <= restRule.thresholdValue) {
          result.push({
            ruleId: restRule.id, ruleType: 'rest_between_class',
            message: `Breaks ${restRule.thresholdValue}-day rest rule — ${daysSince} day${daysSince === 1 ? '' : 's'} since last session`,
            severity: daysSince <= 1 ? 'danger' : 'caution',
          });
        }
      }
    }

    if (volumeValue > 0 && rpe > 0) {
      const capRule = RULES.find(
        r => r.activityClassId === activity.activityClassId && r.ruleType === 'weekly_load_cap' && r.enabled,
      );
      if (capRule) {
        const winStart = addDays(TODAY, -(capRule.windowDays - 1));
        const currentLoad = logs
          .filter(l => clsIds.includes(l.activityId) && l.loggedDate >= winStart && l.loggedDate <= TODAY)
          .reduce((s, l) => s + l.volumeValue * (l.rpe ?? DEFAULT_RPE), 0);
        const projected = currentLoad + volumeValue * rpe;
        if (projected >= capRule.thresholdValue) {
          result.push({ ruleId: capRule.id, ruleType: 'weekly_load_cap', severity: 'danger',
            message: `Projected load ${Math.round(projected)} / ${capRule.thresholdValue} cap` });
        } else if (projected >= capRule.thresholdValue * 0.8) {
          result.push({ ruleId: capRule.id, ruleType: 'weekly_load_cap', severity: 'caution',
            message: `Approaching cap — ${Math.round(projected)} / ${capRule.thresholdValue}` });
        }
      }
    }
    return result;
  }, [logs]);

  return {
    todayDate: TODAY, userName: USER_NAME,
    block: BLOCK,
    activityClasses: ACTIVITY_CLASSES, activities: ACTIVITIES, logs, incidents,
    hasCheckedInToday, classStatuses, suggestions, weeklyProgress,
    dailyScores, loadSeries, flareUpDates, weekLoadThreshold, cleanStreak,
    submitCheckIn, submitLog, submitIncident, checkViolations,
  };
}
