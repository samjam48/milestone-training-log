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
import type { WeeklyProgress, Suggestion } from '../lib/engine';
import type { LoadPoint } from '../lib/load';
import {
  getDashboard,
  listActivityLogs,
  listActivities,
  createActivityLog,
  createDailyCheckIn,
  createFlareUpIncident,
  checkViolations as checkViolationsApi,
  listGoals,
  listRulesByBlock,
  listWeeklyTargetsByBlock,
  listTrainingBlocks,
  createGoal as createGoalApi,
  patchGoal,
  createRule as createRuleApi,
  patchRule,
  deleteRule as deleteRuleApi,
  createTrainingBlock as createTrainingBlockApi,
  createActivity,
  patchActivity,
} from '../lib/api';

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

export interface NewActivityDraft {
  name: string;
  activityClassId: ID;
  type: ActivityType;
  defaultVolumeUnit?: VolumeUnit;
}

export interface GoalDraft {
  title: string;
  targetDate: ISODate;
  timeframe: GoalTimeframe;
  status: GoalStatus;
  description?: string;
  activityClassId?: ID;
  progressValue?: number;
  progressTarget?: number;
  progressUnit?: VolumeUnit;
}

export type GoalPatch = Partial<Omit<GoalDraft, 'title'>> & { title?: string; status?: GoalStatus };

export interface RuleDraft {
  activityClassId: ID | null;
  ruleType: RuleType;
  thresholdValue: number;
  windowDays: number;
  enabled: boolean;
}

export type RulePatch = Partial<Pick<RuleDraft, 'thresholdValue' | 'windowDays' | 'enabled'>>;

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
  hasCheckedInToday: boolean;
  classStatuses: ActivityClassStatus[];
  suggestions: Suggestion[];
  weeklyProgress: WeeklyProgress[];
  dailyScores: DailySafetyScore[];
  loadSeries: LoadPoint[];
  flareUpDates: ISODate[];
  weekLoadThreshold: number;
  cleanStreak: number;
  recoveryStreaks: RecoveryStreak[];
  // F2.0 read fields
  goals: Omit<Goal, 'userId'>[];
  rules: Rule[];
  weeklyTargets: WeeklyTarget[];
  previousBlocks: TrainingBlock[];
  // F2.0 mutations
  submitNewActivity: (draft: NewActivityDraft) => void;
  updateActivity: (activityId: ID, patch: Partial<NewActivityDraft>) => void;
  deactivateActivity: (activityId: ID) => void;
  createGoal: (draft: GoalDraft) => void;
  updateGoal: (goalId: ID, patch: GoalPatch) => void;
  archiveGoal: (goalId: ID) => void;
  createRule: (draft: RuleDraft) => void;
  updateRule: (ruleId: ID, patch: RulePatch) => void;
  deleteRule: (ruleId: ID) => void;
  createTrainingBlock: (draft: BlockDraft) => void;
  // F1.3 mutations
  submitCheckIn: (draft: CheckInDraft) => void;
  submitLog: (draft: LogDraft) => void;
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

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: () => listGoals(),
    refetchOnWindowFocus: false,
  });

  const trainingBlocksQuery = useQuery({
    queryKey: ['training-blocks'],
    queryFn: () => listTrainingBlocks(),
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

  const [liveViolations, setLiveViolations] = React.useState<RuleViolationSnapshot[]>([]);
  const violationDebounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const submitLogMutation = useMutation({
    mutationFn: (draft: LogDraft) =>
      createActivityLog({
        id: crypto.randomUUID(),
        activityId: draft.activityId,
        loggedDate: todayDate,
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
    },
  });

  const submitNewActivityMutation = useMutation({
    mutationFn: (draft: NewActivityDraft) =>
      createActivity({
        id: crypto.randomUUID(),
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
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, patch }: { goalId: ID; patch: GoalPatch }) =>
      patchGoal(goalId, patch as Record<string, unknown>),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const archiveGoalMutation = useMutation({
    mutationFn: (goalId: ID) =>
      patchGoal(goalId, { status: 'paused' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
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

  const createTrainingBlockMutation = useMutation({
    mutationFn: (draft: BlockDraft) =>
      createTrainingBlockApi({
        id: crypto.randomUUID(),
        ...draft,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training-blocks'] });
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

  const submitIncident = React.useCallback((draft: IncidentDraft) => {
    submitIncidentMutation.mutate(draft);
  }, [submitIncidentMutation]);

  const submitNewActivity = React.useCallback((draft: NewActivityDraft) => {
    submitNewActivityMutation.mutate(draft);
  }, [submitNewActivityMutation]);

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

  const createTrainingBlock = React.useCallback((draft: BlockDraft) => {
    createTrainingBlockMutation.mutate(draft);
  }, [createTrainingBlockMutation]);

  const allBlocks = trainingBlocksQuery.data ?? [];
  const previousBlocks = allBlocks.filter((b) => b.id !== (dashboard?.block?.id ?? null));

  return {
    todayDate,
    userName: dashboard?.userName ?? '',
    block: (dashboard?.block ?? EMPTY_BLOCK) as TrainingBlock,
    activityClasses: (dashboard?.activityClasses ?? []) as ActivityClass[],
    activities: resolvedActivities,
    logs: (activityLogsQuery.data ?? []) as ActivityLog[],
    incidents: (dashboard?.incidents ?? []) as FlareUpIncident[],
    hasCheckedInToday: dashboard?.hasCheckedInToday ?? false,
    classStatuses: dashboard?.classStatuses ?? [],
    suggestions: dashboard?.suggestions ?? [],
    weeklyProgress: dashboard?.weeklyProgress ?? [],
    dailyScores: dashboard?.dailyScores ?? [],
    loadSeries: dashboard?.loadSeries ?? [],
    flareUpDates: dashboard?.flareUpDates ?? [],
    weekLoadThreshold: dashboard?.weekLoadThreshold ?? 0,
    cleanStreak: dashboard?.cleanStreak ?? 0,
    recoveryStreaks: dashboard?.recoveryStreaks ?? [],
    // F2.0 read fields
    goals: (goalsQuery.data ?? []) as Omit<Goal, 'userId'>[],
    rules: (rulesQuery.data ?? []) as Rule[],
    weeklyTargets: (weeklyTargetsQuery.data ?? []) as WeeklyTarget[],
    previousBlocks: previousBlocks as TrainingBlock[],
    // F2.0 mutations
    submitNewActivity,
    updateActivity,
    deactivateActivity,
    createGoal,
    updateGoal,
    archiveGoal,
    createRule,
    updateRule,
    deleteRule,
    createTrainingBlock,
    // F1.3 mutations
    submitCheckIn,
    submitLog,
    submitIncident,
    checkViolations,
  };
}
