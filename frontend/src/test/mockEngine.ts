import type {
  MilestoneEngineResult,
  NewActivityClassDraft,
} from '../hooks/useMilestoneEngine';
import { createActivityClass } from '../lib/api';
import type { Suggestion } from '../lib/engine';
import type { Activity, ActivityClass } from '../types';

const CREATED_AT = '2026-04-07T06:00:00Z';
const USER_ID = 'user-1';

function createBaseline(): MilestoneEngineResult {
  return {
    todayDate: '2026-05-28',
    userName: 'Sam',
    block: {
      id: 'blk-test',
      userId: 'user-1',
      name: 'Test block',
      startDate: '2026-04-07',
      endDate: '2026-05-31',
      status: 'active',
      isReviewMilestoneHit: false,
      createdAt: '2026-04-07T06:00:00Z',
    },
    activityClasses: [],
    activities: [],
    logs: [],
    incidents: [],
    checkIns: [],
    hasCheckedInToday: false,
    classStatuses: [],
    suggestionBuckets: [],
    loadRiskSummary: null,
    weeklyProgress: [],
    dailyScores: [],
    loadSeries: [],
    graphClassId: null,
    flareUpDates: [],
    weekLoadThreshold: 0,
    cleanStreak: 0,
    recoveryStreaks: [],
    delayedTaxError: false,
    // F2.0 read fields
    goals: [],
    goalRows: [],
    rules: [],
    weeklyTargets: [],
    previousBlocks: [],
    // F2.0 mutations
    submitNewActivity: () => undefined,
    submitNewActivityClass: async (draft: NewActivityClassDraft) => {
      await createActivityClass({
        id: crypto.randomUUID(),
        name: draft.name,
        type: draft.type,
        description: draft.description,
        defaultRecoveryWindowDays: draft.defaultRecoveryWindowDays ?? 3,
      });
    },
    updateActivityClass: async () => undefined,
    deleteActivityClass: async () => undefined,
    updateActivity: () => undefined,
    deactivateActivity: () => undefined,
    createGoal: () => undefined,
    updateGoal: () => undefined,
    archiveGoal: () => undefined,
    createRule: () => undefined,
    updateRule: () => undefined,
    deleteRule: () => undefined,
    ruleMutationError: null,
    clearRuleMutationError: () => undefined,
    createWeeklyTarget: () => undefined,
    patchWeeklyTarget: () => undefined,
    deleteWeeklyTarget: () => undefined,
    weeklyTargetMutationError: null,
    clearWeeklyTargetMutationError: () => undefined,
    createTrainingBlock: () => undefined,
    setupWeeklyFocus: async () => undefined,
    resetWeeklyFocus: async () => undefined,
    patchFocusTitle: async () => undefined,
    // H10.2 — app shell query status
    isInitialLoading: false,
    isFatalError: false,
    isUnauthorized: false,
    refetchAll: () => undefined,
    // F1.3 mutations
    submitLog: async () => undefined,
    updateLog: async () => undefined,
    deleteLog: async () => undefined,
    submitCheckIn: () => undefined,
    submitIncident: () => undefined,
    checkViolations: () => [],
  };
}

/** Minimal engine stub for App shell tests — mock hook returns this object. */
export const mockEngine: MilestoneEngineResult = createBaseline();

/** Restore default empty stub between tests that mutate `mockEngine`. */
export function resetMockEngine(): void {
  Object.assign(mockEngine, createBaseline());
}

// ---------------------------------------------------------------------------
// C6.3 — dashboard suggestion → Log Activity prefill fixtures
// ---------------------------------------------------------------------------

export const c63MobilityClass: ActivityClass = {
  id: 'cls-mobility',
  userId: USER_ID,
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: CREATED_AT,
};

export const c63StretchActivity: Activity = {
  id: 'act-stretch',
  userId: USER_ID,
  activityClassId: c63MobilityClass.id,
  name: 'Stretching',
  type: 'recovery',
  defaultVolumeUnit: 'minutes',
  isActive: true,
  createdAt: CREATED_AT,
};

export const c63YogaActivity: Activity = {
  id: 'act-yoga',
  userId: USER_ID,
  activityClassId: c63MobilityClass.id,
  name: 'Yoga',
  type: 'recovery',
  defaultVolumeUnit: 'minutes',
  isActive: true,
  createdAt: CREATED_AT,
};

export const c63SafeStretchSuggestion: Suggestion = {
  id: c63StretchActivity.id,
  label: 'Stretching',
  state: 'safe',
  reason: 'Within recovery window.',
  bucket: 'do',
  scope: 'activity',
  activityClassId: c63MobilityClass.id,
};

export const c63CautionYogaSuggestion: Suggestion = {
  id: c63YogaActivity.id,
  label: 'Yoga',
  state: 'caution',
  reason: 'Close to weekly cap.',
  nextSafeDate: '2026-05-30',
  bucket: 'do',
  scope: 'activity',
  activityClassId: c63MobilityClass.id,
};

export const c63DangerSquatSuggestion: Suggestion = {
  id: 'act-heavy-squat',
  label: 'Heavy squat',
  state: 'danger',
  reason: 'Flare-up cooldown active.',
  nextSafeDate: '2026-06-02',
  bucket: 'rest',
  scope: 'activity',
  activityClassId: 'cls-foot',
};

export interface C63DashboardFixtureOptions {
  suggestionBuckets?: Suggestion[];
  activities?: Activity[];
}

/** Engine data for dashboard suggestion → Log Activity prefill tests. */
export function applyC63DashboardFixtures(
  options: C63DashboardFixtureOptions = {},
): void {
  mockEngine.activityClasses = [c63MobilityClass];
  mockEngine.activities = options.activities ?? [c63StretchActivity, c63YogaActivity];
  mockEngine.suggestionBuckets =
    options.suggestionBuckets ?? [c63SafeStretchSuggestion];
}
