// =============================================================================
// Milestone — Core Type Definitions
// -----------------------------------------------------------------------------
// Single source of truth for the data model described in DESIGN.md.
// Local-first: every entity carries `id`, `createdAt`, and (where mutable)
// `updatedAt` so we can do offline-first sync later without restructuring.
// IDs are opaque strings (ULID/UUID at runtime).
// =============================================================================

// -----------------------------------------------------------------------------
// Primitives & shared enums
// -----------------------------------------------------------------------------

export type ID = string;
export type ISODate = string;      // "2025-05-25"           (date only)
export type ISODateTime = string;  // "2025-05-25T08:14:00Z" (full)

/** Functional state colors. Map 1:1 to Daily Safety Score in DESIGN.md. */
export type SafetyState = 'safe' | 'caution' | 'danger';

/** Activities are split into two tracking modes. */
export type ActivityType = 'performance' | 'recovery';

/** How a person felt immediately after an activity. */
export type PostActivityFeel = 'fine' | 'mild_discomfort' | 'bad';

/** Discrete RPE on the standard Borg-derived 1–10 scale. */
export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 0–10 sliders used in the morning check-in. */
export type Score0to10 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Timestamped {
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

// -----------------------------------------------------------------------------
// Activity Class & Activity
// -----------------------------------------------------------------------------

export interface ActivityClass extends Timestamped {
  id: ID;
  userId: ID;
  name: string;                       // "High-intensity foot load"
  description?: string;
  type: ActivityType;
  /** Default recovery window applied to new activities in this class. */
  defaultRecoveryWindowDays: number;  // typically 3
}

export interface Activity extends Timestamped {
  id: ID;
  userId: ID;
  activityClassId: ID;
  name: string;                       // "Morning walk"
  type: ActivityType;
  /** Unit auto-populated into the log form (km, reps, sets, sessions...). */
  defaultVolumeUnit?: VolumeUnit;
  isActive: boolean;
}

export type VolumeUnit =
  | 'km' | 'mi' | 'm'
  | 'kg'
  | 'reps' | 'sets' | 'sessions'
  | 'minutes';

// -----------------------------------------------------------------------------
// ActivityLog — the central logged event
// -----------------------------------------------------------------------------

export interface ActivityLog extends Timestamped {
  id: ID;
  userId: ID;
  activityId: ID;
  loggedDate: ISODate;
  /** Required: minutes spent. */
  durationMinutes: number;
  /** Required: numeric volume in the activity's unit. */
  volumeValue: number;
  volumeUnit?: VolumeUnit;
  rpe?: RPE;
  postActivityFeel?: PostActivityFeel;
  notes?: string;
  /** Snapshot of rule violations flagged at submit time, if any. */
  ruleViolationsAtLog?: RuleViolationSnapshot[];
}

/** Frozen description of a rule the user overrode when logging. */
export interface RuleViolationSnapshot {
  ruleId: ID;
  ruleType: RuleType;
  message: string;                    // "Breaks 2-day rest rule for foot-load"
  severity: SafetyState;              // caution | danger
}

// -----------------------------------------------------------------------------
// DailyCheckIn — once per calendar day
// -----------------------------------------------------------------------------

export interface DailyCheckIn extends Timestamped {
  id: ID;
  userId: ID;
  checkInDate: ISODate;               // unique per (userId, date)
  painLevel: Score0to10;
  readinessLevel: Score0to10;
  stiffnessLevel: Score0to10;
  hasFlareUp: boolean;
  /** Present iff hasFlareUp === true. Mirrors the FlareUpIncident fields. */
  flareUp?: {
    bodyPart: string;
    severity: Score0to10;
    likelyCauseActivityClassIds: ID[];
  };
  notes?: string;
}

export interface FlareUpIncident extends Timestamped {
  id: ID;
  userId: ID;
  incidentDate: ISODate;
  bodyPart: string;
  severity: Score0to10;
  /** Optional self-attribution; correlation engine may suggest others. */
  activityClassId?: ID;
  /** FK back to the check-in that surfaced this, if any. */
  dailyCheckInId?: ID;
  notes?: string;
}

// -----------------------------------------------------------------------------
// Training Block — Rules, Targets, Lifecycle
// -----------------------------------------------------------------------------

export type TrainingBlockStatus = 'active' | 'completed' | 'archived';

export interface TrainingBlock extends Timestamped {
  id: ID;
  userId: ID;
  name: string;                       // "Week 3-4 Rehab Progression"
  startDate: ISODate;
  endDate?: ISODate;
  status: TrainingBlockStatus;
  /** Optional link to a Goal this block is in service of. */
  relatedGoalId?: ID;
  notes?: string;
  /** True once weekly volume hit + 2 consecutive safe days. */
  isReviewMilestoneHit: boolean;
}

export type RuleType =
  | 'rest_between_class'      // min N days between same-class activities
  | 'frequency_limit'         // max N activities per window
  | 'weekly_load_cap'         // sum(volume * rpe) ≤ N per week
  | 'consecutive_day_limit'   // max N consecutive days with activity
  | 'weekly_activity_count';  // cross-class: max N performance acts / week

export interface Rule extends Timestamped {
  id: ID;
  trainingBlockId: ID;
  /** null => cross-class rule (e.g. weekly_activity_count). */
  activityClassId: ID | null;
  ruleType: RuleType;
  thresholdValue: number;
  windowDays: number;                 // typically 7
  enabled: boolean;
}

export interface RecoveryTarget extends Timestamped {
  id: ID;
  trainingBlockId: ID;
  activityId: ID;                     // must reference a `recovery`-type activity
  targetFrequency: number;            // 2 (for "2× daily")
  frequencyUnit: 'daily' | 'weekly';
  currentStreakDays: number;
}

/** Weekly target attached to a performance activity class (e.g. "Walk 10 km"). */
export interface WeeklyTarget extends Timestamped {
  id: ID;
  trainingBlockId: ID;
  activityClassId: ID;
  targetValue: number;
  targetUnit: VolumeUnit;
}

// -----------------------------------------------------------------------------
// Goal
// -----------------------------------------------------------------------------

export type GoalTimeframe = 'monthly' | 'quarterly';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'paused';

export interface Goal extends Timestamped {
  id: ID;
  userId: ID;
  title: string;                      // "Walk 20km without flare-up"
  description?: string;
  targetDate: ISODate;
  timeframe: GoalTimeframe;
  /** null => cross-class goal. */
  activityClassId?: ID;
  /** Linked activity for auto-tracked or activity-scoped goals. */
  activityId?: ID;
  /** When true, progress_value is recomputed from matching activity logs. */
  autoTrackProgress?: boolean;
  /** Numeric progress (e.g. km walked). Optional for qualitative goals. */
  progressValue?: number;
  progressTarget?: number;
  progressUnit?: VolumeUnit;
  status: GoalStatus;
}

/** Dashboard summary row for GoalsCard (S25.B7 / GoalDashboardRowRead). */
export interface GoalDashboardRow {
  goalId: string;
  title: string;
  status: GoalStatus;
  activityId: string | null;
  progressValue: number | null;
  progressTarget: number | null;
  progressUnit: string | null;
  fillRatio: number | null;
  isQualitative: boolean;
}

// -----------------------------------------------------------------------------
// Computed / derived shapes (not stored — produced by the rules engine)
// -----------------------------------------------------------------------------

/** Per-day rollup used by the calendar heatmap. */
export interface DailySafetyScore {
  date: ISODate;
  state: SafetyState | 'neutral';
  violations: RuleViolationSnapshot[];
  hadFlareUp: boolean;
  painLevel?: Score0to10;
}

/** Recovery streak surfaced on the dashboard from active block targets. */
export interface RecoveryStreak {
  recoveryTargetId: ID;
  activityId: ID;
  activityName: string;
  activityClassId: ID;
  targetFrequency: number;
  frequencyUnit: 'daily' | 'weekly';
  currentStreakDays: number;
}

/** Per-class status shown on the dashboard traffic light. */
export interface ActivityClassStatus {
  activityClassId: ID;
  state: SafetyState;
  label: string;                      // "Safe" | "Risky" | "Resting"
  lastDoneDate?: ISODate;
  nextSafeDate?: ISODate;
  reason?: string;                    // "Last done 2 days ago, rest 3"
}

export type { LoadPoint } from './lib/load';
