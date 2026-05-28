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
  DailySafetyScore,
  FlareUpIncident,
  ID,
  ISODate,
  ISODateTime,
  PostActivityFeel,
  RecoveryStreak,
  RPE,
  RuleViolationSnapshot,
  Score0to10,
  TrainingBlock,
  VolumeUnit,
} from '../types';
import type { WeeklyProgress, Suggestion } from '../lib/engine';
import type { LoadPoint } from '../lib/load';
import {
  getDashboard,
  listActivityLogs,
  createActivityLog,
  createDailyCheckIn,
  createFlareUpIncident,
  checkViolations as checkViolationsApi,
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

  const dashboard = dashboardQuery.data;
  const todayDate = dashboard?.todayDate ?? ('' as ISODate);

  const [violationResults, setViolationResults] = React.useState<RuleViolationSnapshot[]>([]);
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
        ruleViolationsAtLog: draft.ruleViolationsAtLog ?? violationResults,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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

      void checkViolationsApi({ activityId, volumeValue, rpe, asOf }).then((response) => {
        setViolationResults(response.violations);
      });
    }, VIOLATION_DEBOUNCE_MS);

    return violationResults;
  }, [queryClient, todayDate, violationResults]);

  const submitCheckIn = React.useCallback((draft: CheckInDraft) => {
    submitCheckInMutation.mutate(draft);
  }, [submitCheckInMutation]);

  const submitLog = React.useCallback((draft: LogDraft) => {
    submitLogMutation.mutate(draft);
  }, [submitLogMutation]);

  const submitIncident = React.useCallback((draft: IncidentDraft) => {
    submitIncidentMutation.mutate(draft);
  }, [submitIncidentMutation]);

  return {
    todayDate,
    userName: dashboard?.userName ?? '',
    block: (dashboard?.block ?? EMPTY_BLOCK) as TrainingBlock,
    activityClasses: (dashboard?.activityClasses ?? []) as ActivityClass[],
    activities: (dashboard?.activities ?? []) as Activity[],
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
    submitCheckIn,
    submitLog,
    submitIncident,
    checkViolations,
  };
}
