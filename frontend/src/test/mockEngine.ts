import type { MilestoneEngineResult } from '../hooks/useMilestoneEngine';
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
    hasCheckedInToday: false,
    classStatuses: [],
    suggestions: [],
    weeklyProgress: [],
    dailyScores: [],
    loadSeries: [],
    flareUpDates: [],
    weekLoadThreshold: 0,
    cleanStreak: 0,
    recoveryStreaks: [],
    submitLog: () => undefined,
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
};

export const c63CautionYogaSuggestion: Suggestion = {
  id: c63YogaActivity.id,
  label: 'Yoga',
  state: 'caution',
  reason: 'Close to weekly cap.',
  nextSafeDate: '2026-05-30',
};

export const c63DangerSquatSuggestion: Suggestion = {
  id: 'act-heavy-squat',
  label: 'Heavy squat',
  state: 'danger',
  reason: 'Flare-up cooldown active.',
  nextSafeDate: '2026-06-02',
};

export interface C63DashboardFixtureOptions {
  suggestions?: Suggestion[];
  activities?: Activity[];
}

/** Engine data for dashboard suggestion → Log Activity prefill tests. */
export function applyC63DashboardFixtures(
  options: C63DashboardFixtureOptions = {},
): void {
  mockEngine.activityClasses = [c63MobilityClass];
  mockEngine.activities = options.activities ?? [c63StretchActivity, c63YogaActivity];
  mockEngine.suggestions = options.suggestions ?? [c63SafeStretchSuggestion];
}
