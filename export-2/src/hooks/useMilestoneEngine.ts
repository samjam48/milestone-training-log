// =============================================================================
// useMilestoneEngine — Tier 4 mock hook  (v2)
// -----------------------------------------------------------------------------
// v2 changes (May 2026):
//   • activities, rules, block, previousBlocks, goals are now reactive useState
//   • All derived memos updated to track reactive deps
//   • 9 new mutations: submitNewActivity, editActivity, deactivateActivity,
//     submitGoal, editGoal, archiveGoal, editRule, submitNewBlock, resetMockData
//   • MilestoneEngineResult extended with weeklyTargets, previousBlocks, goals,
//     rules (reactive), and all new mutations
// =============================================================================

import * as React from 'react';
import type {
  ActivityLog, DailyCheckIn, FlareUpIncident, Activity, Rule,
  TrainingBlock, Goal, GoalStatus,
  ActivityClassStatus, DailySafetyScore,
  Score0to10, RPE, PostActivityFeel, VolumeUnit, ISODate, ID,
  RuleViolationSnapshot, GoalTimeframe, ActivityType,
} from '../types';
import {
  TODAY, PERIOD_START, USER_ID, USER_NAME,
  BLOCK, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES,
  WEEKLY_TARGETS, CHECK_INS, INCIDENTS,
  GOALS, PREVIOUS_BLOCKS,
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
  activityId: ID;
  durationMinutes: number;
  volumeValue: number;
  volumeUnit?: VolumeUnit;
  rpe?: RPE;
  postActivityFeel?: PostActivityFeel;
  notes?: string;
  ruleViolationsAtLog?: RuleViolationSnapshot[];
}

export interface IncidentDraft {
  bodyPart: string;
  severity: Score0to10;
  activityClassId?: ID;
  notes?: string;
}

export interface NewActivityDraft {
  name: string;
  activityClassId: ID;
  type: ActivityType;
  defaultVolumeUnit?: VolumeUnit;
}

export interface GoalDraft {
  title: string;
  timeframe: GoalTimeframe;
  targetDate?: ISODate | null;
  activityClassId?: ID | null;
  progressValue?: number | null;
  progressTarget?: number | null;
  progressUnit?: VolumeUnit | null;
}

export interface NewBlockDraft {
  name: string;
  startDate: ISODate;
  endDate?: ISODate | null;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface MilestoneEngineResult {
  // Identity
  todayDate: ISODate;
  userName: string;
  // Block (reactive)
  block: TrainingBlock;
  previousBlocks: TrainingBlock[];
  // Raw data
  activityClasses: typeof ACTIVITY_CLASSES;
  activities: Activity[];
  rules: Rule[];
  weeklyTargets: typeof WEEKLY_TARGETS;
  logs: ActivityLog[];
  incidents: FlareUpIncident[];
  goals: Goal[];
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
  // Core mutations (unchanged from v1)
  submitCheckIn: (draft: CheckInDraft) => void;
  submitLog: (draft: LogDraft) => void;
  submitIncident: (draft: IncidentDraft) => void;
  checkViolations: (activityId: ID, volumeValue: number, rpe: number) => RuleViolationSnapshot[];
  // Activity mutations (new in v2)
  submitNewActivity: (draft: NewActivityDraft) => Activity;
  editActivity: (activityId: ID, updates: Partial<Activity>) => void;
  deactivateActivity: (activityId: ID) => void;
  // Goal mutations (new in v2)
  submitGoal: (draft: GoalDraft) => void;
  editGoal: (goalId: ID, updates: Partial<GoalDraft>) => void;
  archiveGoal: (goalId: ID) => void;
  // Rule + block mutations (new in v2)
  editRule: (ruleId: ID, updates: Partial<Pick<Rule, 'thresholdValue' | 'enabled'>>) => void;
  submitNewBlock: (draft: NewBlockDraft) => void;
  resetMockData: () => void;
}

// ---------------------------------------------------------------------------
// Monotonic counters for mock IDs
// ---------------------------------------------------------------------------

let logCounter = 100;
let ciCounter  = 100;
let incCounter = 100;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMilestoneEngine(): MilestoneEngineResult {

  // ── Reactive state ─────────────────────────────────────────────────────────
  const [logs,           setLogs]           = React.useState<ActivityLog[]>(() => [...LOGS]);
  const [checkIns,       setCheckIns]       = React.useState<DailyCheckIn[]>(() => [...CHECK_INS]);
  const [incidents,      setIncidents]      = React.useState<FlareUpIncident[]>(() => [...INCIDENTS]);
  const [activities,     setActivities]     = React.useState<Activity[]>(() => [...ACTIVITIES]);
  const [rules,          setRules]          = React.useState<Rule[]>(() => [...RULES]);
  const [block,          setBlock]          = React.useState<TrainingBlock>(() => ({ ...BLOCK }));
  const [previousBlocks, setPreviousBlocks] = React.useState<TrainingBlock[]>(() => [...PREVIOUS_BLOCKS]);
  const [goals,          setGoals]          = React.useState<Goal[]>(() => [...GOALS]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasCheckedInToday = React.useMemo(
    () => checkIns.some(c => c.checkInDate === TODAY),
    [checkIns],
  );

  const classStatuses = React.useMemo(
    () => computeClassStatuses(TODAY, ACTIVITY_CLASSES, activities, logs, rules),
    [activities, logs, rules],
  );

  const suggestions = React.useMemo(
    () => computeSuggestions(classStatuses, activities, ACTIVITY_CLASSES),
    [classStatuses, activities],
  );

  const weeklyProgress = React.useMemo(
    () => computeWeeklyProgress(WEEKLY_TARGETS, ACTIVITY_CLASSES, activities, logs, PERIOD_START, TODAY),
    [activities, logs],
  );

  const dailyScores = React.useMemo(
    () => computeDailySafetyScores(block.startDate, TODAY, logs, checkIns, incidents),
    [block, logs, checkIns, incidents],
  );

  const loadSeries = React.useMemo(
    () => computeLoadSeries('cls-foot', activities, logs, block.startDate, TODAY),
    [block, activities, logs],
  );

  const flareUpDates = React.useMemo(
    () => incidents.map(i => i.incidentDate),
    [incidents],
  );

  const weekLoadThreshold = React.useMemo(
    () => rules.find(
      r => r.activityClassId === 'cls-foot' && r.ruleType === 'weekly_load_cap',
    )?.thresholdValue ?? 120,
    [rules],
  );

  const cleanStreak = React.useMemo(() => computeCleanStreak(logs), [logs]);

  // ── Core mutations ─────────────────────────────────────────────────────────

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
      setIncidents(prev => [...prev, {
        id: `inc-${incCounter++}`, userId: USER_ID,
        incidentDate: TODAY,
        bodyPart: draft.flareUpBodyPart ?? 'Unknown',
        severity: draft.flareUpSeverity ?? 5,
        dailyCheckInId: newCi.id,
        createdAt: now,
      }]);
    }
  }, []);

  const submitLog = React.useCallback((draft: LogDraft) => {
    setLogs(prev => [...prev, {
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
      createdAt: new Date().toISOString(),
    }]);
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
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return [];
    const clsIds = activities
      .filter(a => a.activityClassId === activity.activityClassId)
      .map(a => a.id);
    const result: RuleViolationSnapshot[] = [];

    const restRule = rules.find(
      r => r.activityClassId === activity.activityClassId
        && r.ruleType === 'rest_between_class' && r.enabled,
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
      const capRule = rules.find(
        r => r.activityClassId === activity.activityClassId
          && r.ruleType === 'weekly_load_cap' && r.enabled,
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
  }, [logs, activities, rules]);

  // ── Activity mutations ─────────────────────────────────────────────────────

  const submitNewActivity = React.useCallback((draft: NewActivityDraft): Activity => {
    const newAct: Activity = {
      id: `act-${Date.now()}`, userId: USER_ID,
      activityClassId: draft.activityClassId,
      name: draft.name,
      type: draft.type,
      defaultVolumeUnit: draft.defaultVolumeUnit,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setActivities(prev => [...prev, newAct]);
    return newAct;
  }, []);

  const editActivity = React.useCallback((activityId: ID, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
  }, []);

  const deactivateActivity = React.useCallback((activityId: ID) => {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, isActive: false } : a));
  }, []);

  // ── Goal mutations ─────────────────────────────────────────────────────────

  const submitGoal = React.useCallback((draft: GoalDraft) => {
    setGoals(prev => [...prev, {
      id: `goal-${Date.now()}`, userId: USER_ID,
      status: 'active' as GoalStatus,
      title: draft.title,
      timeframe: draft.timeframe,
      targetDate: draft.targetDate ?? TODAY,
      activityClassId: draft.activityClassId ?? undefined,
      progressValue: draft.progressValue ?? undefined,
      progressTarget: draft.progressTarget ?? undefined,
      progressUnit: draft.progressUnit ?? undefined,
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  const editGoal = React.useCallback((goalId: ID, updates: Partial<GoalDraft>) => {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        title:           updates.title           ?? g.title,
        timeframe:       updates.timeframe        ?? g.timeframe,
        targetDate:      updates.targetDate       ?? g.targetDate,
        activityClassId: updates.activityClassId  ?? g.activityClassId,
        progressValue:   updates.progressValue    ?? g.progressValue,
        progressTarget:  updates.progressTarget   ?? g.progressTarget,
        progressUnit:    updates.progressUnit     ?? g.progressUnit,
      };
    }));
  }, []);

  const archiveGoal = React.useCallback((goalId: ID) => {
    setGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, status: 'achieved' as GoalStatus } : g,
    ));
  }, []);

  // ── Rule + block mutations ─────────────────────────────────────────────────

  const editRule = React.useCallback((
    ruleId: ID,
    updates: Partial<Pick<Rule, 'thresholdValue' | 'enabled'>>,
  ) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  }, []);

  const submitNewBlock = React.useCallback((draft: NewBlockDraft) => {
    setPreviousBlocks(prev => [...prev, { ...block, status: 'completed' as const }]);
    setBlock({
      id: `blk-${Date.now()}`, userId: USER_ID,
      name: draft.name,
      startDate: draft.startDate,
      endDate: draft.endDate ?? undefined,
      status: 'active',
      isReviewMilestoneHit: false,
      createdAt: new Date().toISOString(),
    });
  }, [block]);

  const resetMockData = React.useCallback(() => {
    setLogs([...LOGS]);
    setCheckIns([...CHECK_INS]);
    setIncidents([...INCIDENTS]);
    setActivities([...ACTIVITIES]);
    setGoals([...GOALS]);
    setRules([...RULES]);
    setBlock({ ...BLOCK });
    setPreviousBlocks([...PREVIOUS_BLOCKS]);
    logCounter = 100;
    ciCounter  = 100;
    incCounter = 100;
  }, []);

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    todayDate: TODAY, userName: USER_NAME,
    block, previousBlocks,
    activityClasses: ACTIVITY_CLASSES,
    activities, rules, weeklyTargets: WEEKLY_TARGETS,
    logs, incidents, goals,
    hasCheckedInToday, classStatuses, suggestions, weeklyProgress,
    dailyScores, loadSeries, flareUpDates, weekLoadThreshold, cleanStreak,
    submitCheckIn, submitLog, submitIncident, checkViolations,
    submitNewActivity, editActivity, deactivateActivity,
    submitGoal, editGoal, archiveGoal,
    editRule, submitNewBlock, resetMockData,
  };
}
