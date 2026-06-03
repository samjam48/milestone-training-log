// =============================================================================
// mockData.ts — seed data for the Tier 4 mock rules engine
// -----------------------------------------------------------------------------
// Scenario: Sam Chen, recovering from left-heel plantar fasciitis.
// Block: "Return to Walking — Phase 2" (Apr 7 – May 31, 2026).
// Today: 2026-05-25 (Monday). No check-in yet today → CTA shows.
//
// Two historical flare-ups:
//   Apr 24 — near-cap stationary bike session, 3-day rest rule violated
//   May 16 — double violation week (rest + load cap breached at 133 units)
// =============================================================================

import type {
  ActivityClass, Activity, ActivityLog, DailyCheckIn,
  FlareUpIncident, TrainingBlock, Rule, WeeklyTarget, Goal,
} from '../types';

export const TODAY = '2026-05-25';
export const PERIOD_START = '2026-05-19'; // rolling 7-day window start
export const USER_NAME = 'Sam';
export const USER_ID = 'user-1';

// ---------------------------------------------------------------------------
// Training block
// ---------------------------------------------------------------------------
export const BLOCK: TrainingBlock = {
  id: 'blk-1', userId: USER_ID,
  name: 'Return to Walking — Phase 2',
  startDate: '2026-04-07', endDate: '2026-05-31',
  status: 'active', isReviewMilestoneHit: false,
  createdAt: '2026-04-07T06:00:00Z',
};

// ---------------------------------------------------------------------------
// Activity classes
// ---------------------------------------------------------------------------
export const ACTIVITY_CLASSES: ActivityClass[] = [
  { id: 'cls-foot',     userId: USER_ID, name: 'High-Intensity Foot Load', type: 'performance', defaultRecoveryWindowDays: 3, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'cls-recovery', userId: USER_ID, name: 'Low-Impact Recovery',      type: 'recovery',    defaultRecoveryWindowDays: 1, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'cls-upper',    userId: USER_ID, name: 'Upper Body Strength',       type: 'performance', defaultRecoveryWindowDays: 2, createdAt: '2026-04-07T06:00:00Z' },
];

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const ACTIVITIES: Activity[] = [
  { id: 'act-walk',    userId: USER_ID, activityClassId: 'cls-foot',     name: 'Morning Walk',      type: 'performance', defaultVolumeUnit: 'km',      isActive: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'act-bike',    userId: USER_ID, activityClassId: 'cls-foot',     name: 'Stationary Bike',   type: 'performance', defaultVolumeUnit: 'minutes', isActive: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'act-stretch', userId: USER_ID, activityClassId: 'cls-recovery', name: 'Light Stretching',  type: 'recovery',    defaultVolumeUnit: 'minutes', isActive: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'act-pool',    userId: USER_ID, activityClassId: 'cls-recovery', name: 'Pool Walking',      type: 'recovery',    defaultVolumeUnit: 'minutes', isActive: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'act-bands',   userId: USER_ID, activityClassId: 'cls-upper',    name: 'Resistance Bands',  type: 'performance', defaultVolumeUnit: 'sets',    isActive: true, createdAt: '2026-04-07T06:00:00Z' },
];

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
export const RULES: Rule[] = [
  { id: 'rule-rest-foot',  trainingBlockId: 'blk-1', activityClassId: 'cls-foot',  ruleType: 'rest_between_class', thresholdValue: 3,   windowDays: 3,  enabled: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'rule-cap-foot',   trainingBlockId: 'blk-1', activityClassId: 'cls-foot',  ruleType: 'weekly_load_cap',    thresholdValue: 120, windowDays: 7,  enabled: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'rule-freq-foot',  trainingBlockId: 'blk-1', activityClassId: 'cls-foot',  ruleType: 'frequency_limit',    thresholdValue: 3,   windowDays: 7,  enabled: true, createdAt: '2026-04-07T06:00:00Z' },
  { id: 'rule-rest-upper', trainingBlockId: 'blk-1', activityClassId: 'cls-upper', ruleType: 'rest_between_class', thresholdValue: 2,   windowDays: 2,  enabled: true, createdAt: '2026-04-07T06:00:00Z' },
];

// ---------------------------------------------------------------------------
// Weekly targets
// ---------------------------------------------------------------------------
export const WEEKLY_TARGETS: WeeklyTarget[] = [
  { id: 'wt-foot',     trainingBlockId: 'blk-1', activityClassId: 'cls-foot',     targetValue: 8, targetUnit: 'km',       createdAt: '2026-04-07T06:00:00Z' },
  { id: 'wt-recovery', trainingBlockId: 'blk-1', activityClassId: 'cls-recovery', targetValue: 4, targetUnit: 'sessions', createdAt: '2026-04-07T06:00:00Z' },
];

// ---------------------------------------------------------------------------
// Activity logs — 26 entries across 7 weeks
// ---------------------------------------------------------------------------
const CA = '2026-04-07T06:00:00Z'; // common createdAt for brevity

export const LOGS: ActivityLog[] = [
  // Week 1
  { id: 'log-01', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-04-08', durationMinutes: 20, volumeValue: 1.5, volumeUnit: 'km',      rpe: 3, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-02', userId: USER_ID, activityId: 'act-bands',   loggedDate: '2026-04-10', durationMinutes: 30, volumeValue: 3,   volumeUnit: 'sets',    rpe: 3, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-03', userId: USER_ID, activityId: 'act-stretch', loggedDate: '2026-04-12', durationMinutes: 15, volumeValue: 15,  volumeUnit: 'minutes', rpe: 1, postActivityFeel: 'fine',             createdAt: CA },
  // Week 2
  { id: 'log-04', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-04-14', durationMinutes: 25, volumeValue: 2.0, volumeUnit: 'km',      rpe: 4, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-05', userId: USER_ID, activityId: 'act-stretch', loggedDate: '2026-04-16', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 1, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-06', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-04-17', durationMinutes: 25, volumeValue: 2.5, volumeUnit: 'km',      rpe: 5, postActivityFeel: 'mild_discomfort',  createdAt: CA,
    ruleViolationsAtLog: [{ ruleId: 'rule-rest-foot', ruleType: 'rest_between_class', message: 'Only 3 days since last foot-load session — rest window not complete', severity: 'caution' }] },
  { id: 'log-07', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-04-19', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  // Week 3
  { id: 'log-08', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-04-21', durationMinutes: 30, volumeValue: 3.0, volumeUnit: 'km',      rpe: 5, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-09', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-04-22', durationMinutes: 30, volumeValue: 30,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-10', userId: USER_ID, activityId: 'act-bike',    loggedDate: '2026-04-24', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 5, postActivityFeel: 'bad',              createdAt: CA,
    ruleViolationsAtLog: [{ ruleId: 'rule-rest-foot', ruleType: 'rest_between_class', message: 'Breaks 3-day rest rule for foot load — only 3 days since morning walk', severity: 'caution' }] },
  // Week 4 — recovery
  { id: 'log-11', userId: USER_ID, activityId: 'act-stretch', loggedDate: '2026-04-28', durationMinutes: 15, volumeValue: 15,  volumeUnit: 'minutes', rpe: 1, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-12', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-04-30', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-13', userId: USER_ID, activityId: 'act-stretch', loggedDate: '2026-05-02', durationMinutes: 15, volumeValue: 15,  volumeUnit: 'minutes', rpe: 1, postActivityFeel: 'fine',             createdAt: CA },
  // Week 5 — return
  { id: 'log-14', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-05-05', durationMinutes: 20, volumeValue: 1.5, volumeUnit: 'km',      rpe: 3, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-15', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-05-07', durationMinutes: 25, volumeValue: 25,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-16', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-05-09', durationMinutes: 25, volumeValue: 2.0, volumeUnit: 'km',      rpe: 4, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-17', userId: USER_ID, activityId: 'act-bands',   loggedDate: '2026-05-11', durationMinutes: 30, volumeValue: 3,   volumeUnit: 'sets',    rpe: 3, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-18', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-05-12', durationMinutes: 30, volumeValue: 30,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  // Week 6 — escalation → second flare
  { id: 'log-19', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-05-13', durationMinutes: 30, volumeValue: 2.5, volumeUnit: 'km',      rpe: 5, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-20', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-05-14', durationMinutes: 30, volumeValue: 30,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-21', userId: USER_ID, activityId: 'act-bike',    loggedDate: '2026-05-15', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 5, postActivityFeel: 'mild_discomfort',  createdAt: CA,
    ruleViolationsAtLog: [{ ruleId: 'rule-rest-foot', ruleType: 'rest_between_class', message: 'Breaks 3-day rest rule for foot load — 2 days since last walk', severity: 'caution' }] },
  { id: 'log-22', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-05-16', durationMinutes: 30, volumeValue: 3.0, volumeUnit: 'km',      rpe: 7, postActivityFeel: 'bad',              createdAt: CA,
    ruleViolationsAtLog: [{ ruleId: 'rule-rest-foot', ruleType: 'rest_between_class', message: 'Breaks 3-day rest rule for foot load — 1 day since last session', severity: 'danger' }] },
  // Week 7 — careful recovery
  { id: 'log-23', userId: USER_ID, activityId: 'act-stretch', loggedDate: '2026-05-19', durationMinutes: 15, volumeValue: 15,  volumeUnit: 'minutes', rpe: 1, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-24', userId: USER_ID, activityId: 'act-pool',    loggedDate: '2026-05-21', durationMinutes: 20, volumeValue: 20,  volumeUnit: 'minutes', rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-25', userId: USER_ID, activityId: 'act-walk',    loggedDate: '2026-05-22', durationMinutes: 20, volumeValue: 1.5, volumeUnit: 'km',      rpe: 3, postActivityFeel: 'fine',             createdAt: CA },
  { id: 'log-26', userId: USER_ID, activityId: 'act-bands',   loggedDate: '2026-05-24', durationMinutes: 30, volumeValue: 3,   volumeUnit: 'sets',    rpe: 2, postActivityFeel: 'fine',             createdAt: CA },
];

// ---------------------------------------------------------------------------
// Morning check-ins (sparse — not every day)
// ---------------------------------------------------------------------------
export const CHECK_INS: DailyCheckIn[] = [
  { id: 'ci-1', userId: USER_ID, checkInDate: '2026-04-24', painLevel: 7, readinessLevel: 2, stiffnessLevel: 8, hasFlareUp: true,  flareUp: { bodyPart: 'Left heel', severity: 7, likelyCauseActivityClassIds: ['cls-foot'] }, createdAt: CA },
  { id: 'ci-2', userId: USER_ID, checkInDate: '2026-04-28', painLevel: 4, readinessLevel: 4, stiffnessLevel: 5, hasFlareUp: false, createdAt: CA },
  { id: 'ci-3', userId: USER_ID, checkInDate: '2026-05-05', painLevel: 2, readinessLevel: 7, stiffnessLevel: 3, hasFlareUp: false, createdAt: CA },
  { id: 'ci-4', userId: USER_ID, checkInDate: '2026-05-16', painLevel: 8, readinessLevel: 1, stiffnessLevel: 9, hasFlareUp: true,  flareUp: { bodyPart: 'Left heel', severity: 8, likelyCauseActivityClassIds: ['cls-foot'] }, createdAt: CA },
  { id: 'ci-5', userId: USER_ID, checkInDate: '2026-05-22', painLevel: 2, readinessLevel: 7, stiffnessLevel: 3, hasFlareUp: false, createdAt: CA },
  { id: 'ci-6', userId: USER_ID, checkInDate: '2026-05-24', painLevel: 1, readinessLevel: 8, stiffnessLevel: 2, hasFlareUp: false, createdAt: CA },
  // May 25 intentionally absent → CheckInPromptCard shows
];

// ---------------------------------------------------------------------------
// Flare-up incidents
// ---------------------------------------------------------------------------
export const INCIDENTS: FlareUpIncident[] = [
  { id: 'inc-1', userId: USER_ID, incidentDate: '2026-04-24', bodyPart: 'Left heel', severity: 6, activityClassId: 'cls-foot', dailyCheckInId: 'ci-1', createdAt: CA },
  { id: 'inc-2', userId: USER_ID, incidentDate: '2026-05-16', bodyPart: 'Left heel', severity: 8, activityClassId: 'cls-foot', dailyCheckInId: 'ci-4', createdAt: CA },
];

// ---------------------------------------------------------------------------
// Goals — active goals for the current block period
// ---------------------------------------------------------------------------
export const GOALS: Goal[] = [
  {
    id: 'goal-1', userId: USER_ID, status: 'active', timeframe: 'monthly',
    title: 'Walk 20 km without a flare-up',
    targetDate: '2026-05-31', activityClassId: 'cls-foot',
    progressValue: 12, progressTarget: 20, progressUnit: 'km',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-2', userId: USER_ID, status: 'active', timeframe: 'monthly',
    title: 'Complete 12 recovery sessions',
    targetDate: '2026-05-31', activityClassId: 'cls-recovery',
    progressValue: 8, progressTarget: 12, progressUnit: 'sessions',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-3', userId: USER_ID, status: 'active', timeframe: 'quarterly',
    title: 'Reduce recovery window from 3 → 2 days for foot load',
    targetDate: '2026-06-30', activityClassId: 'cls-foot',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-4', userId: USER_ID, status: 'active', timeframe: 'quarterly',
    title: 'Four consecutive weeks without a flare-up',
    targetDate: '2026-06-30',
    progressValue: 2, progressTarget: 4, progressUnit: 'sessions',
    createdAt: '2026-04-07T06:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Previous training blocks
// ---------------------------------------------------------------------------
export const PREVIOUS_BLOCKS: TrainingBlock[] = [
  {
    id: 'blk-0', userId: USER_ID,
    name: 'Return to Walking — Phase 1',
    startDate: '2026-02-24', endDate: '2026-04-06',
    status: 'completed', isReviewMilestoneHit: true,
    createdAt: '2026-02-24T06:00:00Z',
  },
];
