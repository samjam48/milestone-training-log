import type { MilestoneEngineResult } from '../hooks/useMilestoneEngine';

/** Minimal engine stub for App shell tests — mock hook returns this object. */
export const mockEngine: MilestoneEngineResult = {
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
  submitLog: () => undefined,
  submitCheckIn: () => undefined,
  submitIncident: () => undefined,
  checkViolations: () => [],
};
