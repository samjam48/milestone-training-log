// =============================================================================
// useMilestoneEngine — Tier 4 data hook
// -----------------------------------------------------------------------------
// Loads dashboard + activity logs via React Query and exposes mutations that
// invalidate the correct cache keys. Derived fields come from GET /dashboard;
// logs come from GET /api/activity-logs (full list).
// =============================================================================

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Activity,
  ActivityClass,
  ActivityClassStatus,
  ActivityLog,
  ActivityType,
  DailySafetyScore,
  FlareUpIncident,
  Goal,
  GoalDashboardRow,
  GoalStatus,
  GoalTimeframe,
  ID,
  ISODate,
  ISODateTime,
  PostActivityFeel,
  RecoveryStreak,
  RPE,
  Rule,
  RuleType,
  RuleViolationSnapshot,
  Score0to10,
  TrainingBlock,
  VolumeUnit,
  WeeklyTarget,
} from '../types';
import type { LoadRiskSummary, WeeklyProgress, Suggestion } from '../lib/engine';
import type { LoadPoint } from '../lib/load';
import { isUnauthorizedError } from '../lib/api/client';
import { addDays } from '../lib/load';
import {
  getDashboard,
  listActivityLogs,
  listActivities,
  listDailyCheckIns,
  createActivityLog,
  patchActivityLog,
  createDailyCheckIn,
  createFlareUpIncident,
  checkViolations as checkViolationsApi,
  listRulesByBlock,
  listWeeklyTargetsByBlock,
  createWeeklyTarget as createWeeklyTargetApi,
  patchWeeklyTarget as patchWeeklyTargetApi,
  createGoal as createGoalApi,
  patchGoal,
  createRule as createRuleApi,
  patchRule,
  deleteRule as deleteRuleApi,
  createTrainingBlock as createTrainingBlockApi,
  createActivity,
  createActivityClass,
  patchActivityClass,
  deleteActivityClass as deleteActivityClassApi,
  patchActivity,
  getDelayedTax,
} from '../lib/api';
import type { DailyCheckInRead } from '../lib/api/mappers';

export type DelayedTaxResponse = Awaited<ReturnType<typeof getDelayedTax>>;

type EntityWithoutUserId<T extends { userId: string }> = Omit<T, 'userId'>;

const VIOLATION_DEBOUNCE_MS = 300;

const EMPTY_BLOCK: EntityWithoutUserId<TrainingBlock> = {
  id: '',
  name: '',
  startDate: '1970-01-01' as ISODate,
  endDate: '1970-01-01' as ISODate,
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '1970-01-01T00:00:00Z' as ISODateTime,
};

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
  loggedDate: ISODate;
  durationMinutes: number;
  volumeValue: number;
  volumeUnit?: VolumeUnit;
  rpe?: RPE;
  postActivityFeel?: PostActivityFeel;
  notes?: string;
  /** Violations detected at submit time — stored on the log for history display. */
  ruleViolationsAtLog?: RuleViolationSnapshot[];
}

export interface LogPatch {
  activityId?: string;
  loggedDate?: ISODate;
  durationMinutes?: number;
  volumeValue?: number;
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
  /** Client-generated id from NewActivitySheet; used when persisting the activity. */
  id?: ID;
  name: string;
  activityClassId: ID;
  type: ActivityType;
  defaultVolumeUnit?: VolumeUnit;
}

export interface NewActivityClassDraft {
  name: string;
  type: ActivityType;
  description?: string;
  defaultRecoveryWindowDays?: number;
}

export interface ActivityClassPatch {
  name?: string;
  type?: ActivityType;
}

export interface GoalDraft {
  title: string;
  targetDate: ISODate;
  timeframe: GoalTimeframe;
  status: GoalStatus;
  description?: string;
  activityClassId?: ID;
  activityId?: ID;
  autoTrackProgress?: boolean;
  progressValue?: number;
  progressTarget?: number;
  progressUnit?: VolumeUnit;
}

export type GoalPatch = Partial<Omit<GoalDraft, 'title'>> & { title?: string; status?: GoalStatus };

export interface RuleDraft {
  activityClassId: ID;
  activityId?: ID;
  ruleType: RuleType;
  thresholdValue: number;
  windowDays: number;
  enabled: boolean;
}

export type RulePatch = Partial<Pick<RuleDraft, 'thresholdValue' | 'windowDays' | 'enabled'>>;

export interface WeeklyTargetDraft {
  activityClassId: ID;
  targetValue: number;
  targetUnit: VolumeUnit;
}

export type WeeklyTargetPatch = Partial<Pick<WeeklyTargetDraft, 'targetValue' | 'targetUnit'>>;

export interface BlockDraft {
  name: string;
  startDate: ISODate;
  endDate?: ISODate;
  relatedGoalId?: ID;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface MilestoneEngineResult {
  todayDate: ISODate;
  userName: string;
  block: TrainingBlock;
  activityClasses: ActivityClass[];
  activities: Activity[];
  logs: ActivityLog[];
  incidents: FlareUpIncident[];
  checkIns: DailyCheckInRead[];
  hasCheckedInToday: boolean;
  classStatuses: ActivityClassStatus[];
  suggestionBuckets: Suggestion[];
  loadRiskSummary: LoadRiskSummary | null;
  weeklyProgress: WeeklyProgress[];
  dailyScores: DailySafetyScore[];
  loadSeries: LoadPoint[];
  graphClassId: string | null;
  flareUpDates: ISODate[];
  weekLoadThreshold: number;
  cleanStreak: number;
  recoveryStreaks: RecoveryStreak[];
  delayedTax?: DelayedTaxResponse;
  /** True when the delayed-tax fetch failed (distinct from still loading). */
  delayedTaxError: boolean;
  // F2.0 read fields
  goals: Omit<Goal, 'userId'>[];
  goalRows: GoalDashboardRow[];
  rules: Rule[];
  weeklyTargets: WeeklyTarget[];
  previousBlocks: TrainingBlock[];
  // F2.0 mutations
  submitNewActivity: (draft: NewActivityDraft) => void;
  submitNewActivityClass: (draft: NewActivityClassDraft) => Promise<void>;
  updateActivityClass: (classId: ID, patch: ActivityClassPatch) => Promise<void>;
  deleteActivityClass: (classId: ID) => Promise<void>;
  updateActivity: (activityId: ID, patch: Partial<NewActivityDraft>) => void;
  deactivateActivity: (activityId: ID) => void;
  createGoal: (draft: GoalDraft) => void;
  updateGoal: (goalId: ID, patch: GoalPatch) => void;
  archiveGoal: (goalId: ID) => void;
  createRule: (draft: RuleDraft) => void;
  updateRule: (ruleId: ID, patch: RulePatch) => void;
  deleteRule: (ruleId: ID) => void;
  createWeeklyTarget: (draft: WeeklyTargetDraft) => void;
  patchWeeklyTarget: (targetId: ID, patch: WeeklyTargetPatch) => void;
  createTrainingBlock: (draft: BlockDraft) => void;
  // H10.2 — app shell query status (no raw React Query objects)
  isInitialLoading: boolean;
  isFatalError: boolean;
  /** True when the dashboard fetch returned 401 (session required). */
  isUnauthorized: boolean;
  refetchAll: () => void;
  // F1.3 mutations
  submitCheckIn: (draft: CheckInDraft) => void;
  submitLog: (draft: LogDraft) => void;
  updateLog: (logId: ID, patch: LogPatch) => void;
  submitIncident: (draft: IncidentDraft) => void;
  checkViolations: (activityId: ID, volumeValue: number, rpe: number) => RuleViolationSnapshot[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMilestoneEngine(): MilestoneEngineResult {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
  });

  const activityLogsQuery = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => listActivityLogs(),
  });

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: () => listActivities(),
  });

  const dashboard = dashboardQuery.data;
  const todayDate = dashboard?.todayDate ?? ('' as ISODate);
  const blockId = dashboard?.block?.id ?? null;

  const checkInsQuery = useQuery({
    queryKey: ['daily-check-ins', todayDate],
    queryFn: () => {
      if (todayDate === '') return Promise.resolve([]);
      const startDate = addDays(todayDate, -365);
      return listDailyCheckIns({ startDate, endDate: todayDate });
    },
    enabled: todayDate !== '',
    refetchOnWindowFocus: false,
  });

  const rulesQuery = useQuery({
    queryKey: ['rules', blockId ?? ''],
    queryFn: () => listRulesByBlock(blockId as string),
    enabled: !!blockId,
    refetchOnWindowFocus: false,
  });

  const weeklyTargetsQuery = useQuery({
    queryKey: ['weekly-targets', blockId ?? ''],
    queryFn: () => listWeeklyTargetsByBlock(blockId as string),
    enabled: !!blockId,
    refetchOnWindowFocus: false,
  });

  const delayedTaxAsOf = dashboard?.todayDate;

  const delayedTaxQuery = useQuery({
    queryKey: ['delayed-tax', delayedTaxAsOf],
    queryFn: () => getDelayedTax({ asOf: delayedTaxAsOf as ISODate }),
    enabled: delayedTaxAsOf !== undefined,
    gcTime: 0,
  });

  const [liveViolations, setLiveViolations] = React.useState<RuleViolationSnapshot[]>([]);
  const violationDebounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const submitLogMutation = useMutation({
    mutationFn: (draft: LogDraft) =>
      createActivityLog({
        id: crypto.randomUUID(),
        activityId: draft.activityId,
        loggedDate: draft.loggedDate,
        durationMinutes: draft.durationMinutes,
        volumeValue: draft.volumeValue,
        volumeUnit: draft.volumeUnit,
        rpe: draft.rpe,
        postActivityFeel: draft.postActivityFeel,
        notes: draft.notes,
        ruleViolationsAtLog: draft.ruleViolationsAtLog ?? liveViolations,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: ['delayed-tax'] });
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ logId, patch }: { logId: ID; patch: LogPatch }) =>
      patchActivityLog(logId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: ['delayed-tax'] });
    },
  });

  const submitCheckInMutation = useMutation({
    mutationFn: (draft: CheckInDraft) =>
      createDailyCheckIn({
        id: crypto.randomUUID(),
        checkInDate: todayDate,
        painLevel: draft.painLevel,
        readinessLevel: draft.readinessLevel,
        stiffnessLevel: draft.stiffnessLevel,
        hasFlareUp: draft.hasFlareUp,
        flareUp: draft.hasFlareUp
          ? {
              bodyPart: draft.flareUpBodyPart ?? 'Unknown',
              severity: draft.flareUpSeverity ?? 5,
              likelyCauseActivityClassIds: [],
            }
          : undefined,
        notes: draft.notes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-check-ins'] });
      void queryClient.invalidateQueries({ queryKey: ['delayed-tax'] });
    },
  });

  const submitIncidentMutation = useMutation({
    mutationFn: (draft: IncidentDraft) =>
      createFlareUpIncident({
        id: crypto.randomUUID(),
        incidentDate: todayDate,
        bodyPart: draft.bodyPart,
        severity: draft.severity,
        activityClassId: draft.activityClassId,
        notes: draft.notes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['delayed-tax'] });
    },
  });

  const submitNewActivityMutation = useMutation({
    mutationFn: (draft: NewActivityDraft) =>
      createActivity({
        id: draft.id ?? crypto.randomUUID(),
        name: draft.name,
        activityClassId: draft.activityClassId,
        type: draft.type,
        defaultVolumeUnit: draft.defaultVolumeUnit,
        isActive: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const submitNewActivityClassMutation = useMutation({
    mutationFn: (draft: NewActivityClassDraft) =>
      createActivityClass({
        id: crypto.randomUUID(),
        name: draft.name,
        type: draft.type,
        description: draft.description ?? '',
        defaultRecoveryWindowDays: draft.defaultRecoveryWindowDays ?? 3,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-classes'] });
    },
  });

  const updateActivityClassMutation = useMutation({
    mutationFn: ({ classId, patch }: { classId: ID; patch: ActivityClassPatch }) =>
      patchActivityClass(classId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-classes'] });
    },
  });

  const deleteActivityClassMutation = useMutation({
    mutationFn: (classId: ID) => deleteActivityClassApi(classId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-classes'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, patch }: { activityId: ID; patch: Partial<NewActivityDraft> }) =>
      patchActivity(activityId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const deactivateActivityMutation = useMutation({
    mutationFn: (activityId: ID) =>
      patchActivity(activityId, { isActive: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (draft: GoalDraft) =>
      createGoalApi({
        id: crypto.randomUUID(),
        ...draft,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, patch }: { goalId: ID; patch: GoalPatch }) =>
      patchGoal(goalId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const archiveGoalMutation = useMutation({
    mutationFn: (goalId: ID) =>
      patchGoal(goalId, { status: 'paused' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (draft: RuleDraft) =>
      createRuleApi(blockId as string, {
        id: crypto.randomUUID(),
        ...draft,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules', blockId ?? ''] });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ ruleId, patch }: { ruleId: ID; patch: RulePatch }) =>
      patchRule(ruleId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules', blockId ?? ''] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: ID) => deleteRuleApi(ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rules', blockId ?? ''] });
    },
  });

  const createWeeklyTargetMutation = useMutation({
    mutationFn: (draft: WeeklyTargetDraft) =>
      createWeeklyTargetApi(blockId as string, {
        id: crypto.randomUUID(),
        ...draft,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weekly-targets', blockId ?? ''] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const patchWeeklyTargetMutation = useMutation({
    mutationFn: ({ targetId, patch }: { targetId: ID; patch: WeeklyTargetPatch }) =>
      patchWeeklyTargetApi(targetId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weekly-targets', blockId ?? ''] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const createTrainingBlockMutation = useMutation({
    mutationFn: (draft: BlockDraft) =>
      createTrainingBlockApi({
        id: crypto.randomUUID(),
        ...draft,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const checkViolations = React.useCallback((
    activityId: ID,
    volumeValue: number,
    rpe: number,
  ): RuleViolationSnapshot[] => {
    if (violationDebounceRef.current !== undefined) {
      clearTimeout(violationDebounceRef.current);
    }

    violationDebounceRef.current = setTimeout(() => {
      const asOf =
        queryClient.getQueryData<Awaited<ReturnType<typeof getDashboard>>>(['dashboard'])
          ?.todayDate ?? todayDate;

      void checkViolationsApi({ activityId, volumeValue, rpe, asOf })
        .then((response) => {
          setLiveViolations(response.violations);
        })
        .catch(() => {
          setLiveViolations([]);
        });
    }, VIOLATION_DEBOUNCE_MS);

    return liveViolations;
  }, [queryClient, todayDate, liveViolations]);

  const dashboardActivities = dashboard?.activities ?? [];
  const resolvedActivities = (
    dashboardActivities.length > 0 ? dashboardActivities : (activitiesQuery.data ?? [])
  ) as Activity[];

  const submitCheckIn = React.useCallback((draft: CheckInDraft) => {
    submitCheckInMutation.mutate(draft);
  }, [submitCheckInMutation]);

  const submitLog = React.useCallback((draft: LogDraft) => {
    submitLogMutation.mutate(draft);
  }, [submitLogMutation]);

  const updateLog = React.useCallback((logId: ID, patch: LogPatch) => {
    updateLogMutation.mutate({ logId, patch });
  }, [updateLogMutation]);

  const submitIncident = React.useCallback((draft: IncidentDraft) => {
    submitIncidentMutation.mutate(draft);
  }, [submitIncidentMutation]);

  const submitNewActivity = React.useCallback((draft: NewActivityDraft) => {
    submitNewActivityMutation.mutate(draft);
  }, [submitNewActivityMutation]);

  const submitNewActivityClass = React.useCallback(async (draft: NewActivityClassDraft) => {
    await submitNewActivityClassMutation.mutateAsync(draft);
  }, [submitNewActivityClassMutation]);

  const updateActivityClass = React.useCallback(async (classId: ID, patch: ActivityClassPatch) => {
    await updateActivityClassMutation.mutateAsync({ classId, patch });
  }, [updateActivityClassMutation]);

  const deleteActivityClass = React.useCallback(async (classId: ID) => {
    await deleteActivityClassMutation.mutateAsync(classId);
  }, [deleteActivityClassMutation]);

  const updateActivity = React.useCallback((activityId: ID, patch: Partial<NewActivityDraft>) => {
    updateActivityMutation.mutate({ activityId, patch });
  }, [updateActivityMutation]);

  const deactivateActivity = React.useCallback((activityId: ID) => {
    deactivateActivityMutation.mutate(activityId);
  }, [deactivateActivityMutation]);

  const createGoal = React.useCallback((draft: GoalDraft) => {
    createGoalMutation.mutate(draft);
  }, [createGoalMutation]);

  const updateGoal = React.useCallback((goalId: ID, patch: GoalPatch) => {
    updateGoalMutation.mutate({ goalId, patch });
  }, [updateGoalMutation]);

  const archiveGoal = React.useCallback((goalId: ID) => {
    archiveGoalMutation.mutate(goalId);
  }, [archiveGoalMutation]);

  const createRule = React.useCallback((draft: RuleDraft) => {
    createRuleMutation.mutate(draft);
  }, [createRuleMutation]);

  const updateRule = React.useCallback((ruleId: ID, patch: RulePatch) => {
    updateRuleMutation.mutate({ ruleId, patch });
  }, [updateRuleMutation]);

  const deleteRule = React.useCallback((ruleId: ID) => {
    deleteRuleMutation.mutate(ruleId);
  }, [deleteRuleMutation]);

  const createWeeklyTarget = React.useCallback((draft: WeeklyTargetDraft) => {
    createWeeklyTargetMutation.mutate(draft);
  }, [createWeeklyTargetMutation]);

  const patchWeeklyTarget = React.useCallback((targetId: ID, patch: WeeklyTargetPatch) => {
    patchWeeklyTargetMutation.mutate({ targetId, patch });
  }, [patchWeeklyTargetMutation]);

  const createTrainingBlock = React.useCallback((draft: BlockDraft) => {
    createTrainingBlockMutation.mutate(draft);
  }, [createTrainingBlockMutation]);

  const isInitialLoading = dashboardQuery.isPending;
  const isUnauthorized =
    dashboardQuery.isError && isUnauthorizedError(dashboardQuery.error);
  const isFatalError =
    dashboardQuery.isError && dashboard === undefined && !isUnauthorized;

  const refetchAll = React.useCallback(() => {
    void dashboardQuery.refetch();
    void activityLogsQuery.refetch();
    void delayedTaxQuery.refetch();
  }, [dashboardQuery, activityLogsQuery, delayedTaxQuery]);

  return {
    todayDate,
    userName: dashboard?.userName ?? '',
    block: (dashboard?.block ?? EMPTY_BLOCK) as TrainingBlock,
    activityClasses: (dashboard?.activityClasses ?? []) as ActivityClass[],
    activities: resolvedActivities,
    logs: (activityLogsQuery.data ?? []) as ActivityLog[],
    incidents: (dashboard?.incidents ?? []) as FlareUpIncident[],
    checkIns: (checkInsQuery.data ?? []) as DailyCheckInRead[],
    hasCheckedInToday: dashboard?.hasCheckedInToday ?? false,
    classStatuses: dashboard?.classStatuses ?? [],
    suggestionBuckets: dashboard?.suggestionBuckets ?? [],
    loadRiskSummary: dashboard?.loadRiskSummary ?? null,
    weeklyProgress: dashboard?.weeklyProgress ?? [],
    dailyScores: dashboard?.dailyScores ?? [],
    loadSeries: dashboard?.loadSeries ?? [],
    graphClassId: dashboard?.graphClassId ?? null,
    flareUpDates: dashboard?.flareUpDates ?? [],
    weekLoadThreshold: dashboard?.weekLoadThreshold ?? 0,
    cleanStreak: dashboard?.cleanStreak ?? 0,
    recoveryStreaks: dashboard?.recoveryStreaks ?? [],
    delayedTax: delayedTaxQuery.data,
    delayedTaxError: delayedTaxQuery.isError,
    // F2.0 read fields
    goals: (dashboard?.goals ?? []) as Omit<Goal, 'userId'>[],
    goalRows: dashboard?.goalRows ?? [],
    rules: (rulesQuery.data ?? []) as Rule[],
    weeklyTargets: (weeklyTargetsQuery.data ?? []) as WeeklyTarget[],
    previousBlocks: (dashboard?.previousBlocks ?? []) as TrainingBlock[],
    // F2.0 mutations
    submitNewActivity,
    submitNewActivityClass,
    updateActivityClass,
    deleteActivityClass,
    updateActivity,
    deactivateActivity,
    createGoal,
    updateGoal,
    archiveGoal,
    createRule,
    updateRule,
    deleteRule,
    createWeeklyTarget,
    patchWeeklyTarget,
    createTrainingBlock,
    // H10.2 — app shell query status
    isInitialLoading,
    isFatalError,
    isUnauthorized,
    refetchAll,
    // F1.3 mutations
    submitCheckIn,
    submitLog,
    updateLog,
    submitIncident,
    checkViolations,
  };
}
