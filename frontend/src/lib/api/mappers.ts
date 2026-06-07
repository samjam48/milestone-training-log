/**
 * Snake↔camel transforms between backend JSON and frontend domain types.
 */
import type {
  Activity,
  ActivityClass,
  ActivityLog,
  DailyCheckIn,
  FlareUpIncident,
  Goal,
  GoalDashboardRow,
  GoalStatus,
  ISODate,
  ISODateTime,
  PostActivityFeel,
  RecoveryStreak,
  RecoveryTarget,
  Rule,
  RuleType,
  RuleViolationSnapshot,
  SafetyState,
  Score0to10,
  TrainingBlock,
  VolumeUnit,
  WeeklyTarget,
} from '../../types';
import type { LoadPoint } from '../load';
import type {
  LoadRiskSummary,
  Suggestion,
  WeeklyProgress,
} from '../engine';

type WithoutUserId<T extends { userId: string }> = Omit<T, 'userId'>;

/** API read shape — nullable optional fields preserve backend null. */
export type ActivityLogRead = Omit<
  WithoutUserId<ActivityLog>,
  'volumeUnit' | 'rpe' | 'postActivityFeel' | 'notes' | 'ruleViolationsAtLog'
> & {
  volumeUnit?: VolumeUnit | null;
  rpe?: ActivityLog['rpe'] | null;
  postActivityFeel?: PostActivityFeel | null;
  notes?: string | null;
  ruleViolationsAtLog?: RuleViolationSnapshot[] | null;
};

export type DailyCheckInRead = Omit<WithoutUserId<DailyCheckIn>, 'notes'> & {
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function mapKeysToSnake(
  obj: Record<string, unknown>,
  options?: { omitUndefined?: boolean },
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (options?.omitUndefined && value === undefined) {
      continue;
    }
    result[camelToSnake(key)] = value;
  }
  return result;
}

function readTimestamped(raw: Record<string, unknown>): {
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
} {
  return {
    createdAt: String(raw.created_at),
    ...(raw.updated_at !== undefined ? { updatedAt: String(raw.updated_at) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Rule violations
// ---------------------------------------------------------------------------

export function mapRuleViolationFromApi(raw: Record<string, unknown>): RuleViolationSnapshot {
  return {
    ruleId: String(raw.rule_id),
    ruleType: raw.rule_type as RuleType,
    message: String(raw.message),
    severity: raw.severity as SafetyState,
  };
}

function mapRuleViolationForApi(violation: RuleViolationSnapshot): Record<string, unknown> {
  return {
    rule_id: violation.ruleId,
    rule_type: violation.ruleType,
    message: violation.message,
    severity: violation.severity,
  };
}

// ---------------------------------------------------------------------------
// Activity logs
// ---------------------------------------------------------------------------

export function mapActivityLogFromApi(raw: Record<string, unknown>): ActivityLogRead {
  const violations = raw.rule_violations_at_log;
  return {
    id: String(raw.id),
    activityId: String(raw.activity_id),
    loggedDate: String(raw.logged_date) as ISODate,
    durationMinutes: Number(raw.duration_minutes),
    volumeValue: Number(raw.volume_value),
    volumeUnit: raw.volume_unit as VolumeUnit | null | undefined,
    rpe: raw.rpe != null ? (Number(raw.rpe) as ActivityLog['rpe']) : (raw.rpe as null | undefined),
    postActivityFeel: raw.post_activity_feel as PostActivityFeel | null | undefined,
    notes: raw.notes as string | null | undefined,
    ruleViolationsAtLog:
      violations === null
        ? null
        : Array.isArray(violations)
          ? violations.map((item) =>
              mapRuleViolationFromApi(isRecord(item) ? item : {}),
            )
          : undefined,
    ...readTimestamped(raw),
  };
}

export function mapActivityLogCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: draft.id,
    activity_id: draft.activityId,
    logged_date: draft.loggedDate,
    duration_minutes: draft.durationMinutes,
    volume_value: draft.volumeValue,
    volume_unit: draft.volumeUnit,
    rpe: draft.rpe,
    post_activity_feel: draft.postActivityFeel,
    notes: draft.notes,
  };

  if (draft.ruleViolationsAtLog !== undefined) {
    const violations = draft.ruleViolationsAtLog;
    body.rule_violations_at_log = Array.isArray(violations)
      ? violations.map((item) => mapRuleViolationForApi(item as RuleViolationSnapshot))
      : violations;
  }

  return body;
}

export function mapActivityLogPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

// ---------------------------------------------------------------------------
// Daily check-ins
// ---------------------------------------------------------------------------

function mapFlareUpFromCheckIn(raw: Record<string, unknown>): DailyCheckIn['flareUp'] {
  const activityClassId = raw.activity_class_id;
  return {
    bodyPart: String(raw.body_part),
    severity: Number(raw.severity) as Score0to10,
    likelyCauseActivityClassIds:
      activityClassId != null && activityClassId !== '' ? [String(activityClassId)] : [],
  };
}

export function mapDailyCheckInFromApi(raw: Record<string, unknown>): DailyCheckInRead {
  const flareUpRaw = raw.flare_up;
  const hasFlareUp = Boolean(raw.has_flare_up);

  return {
    id: String(raw.id),
    checkInDate: String(raw.check_in_date) as ISODate,
    painLevel: Number(raw.pain_level) as Score0to10,
    readinessLevel: Number(raw.readiness_level) as Score0to10,
    stiffnessLevel: Number(raw.stiffness_level) as Score0to10,
    hasFlareUp,
    flareUp:
      hasFlareUp && isRecord(flareUpRaw) ? mapFlareUpFromCheckIn(flareUpRaw) : undefined,
    notes: raw.notes as string | null | undefined,
    ...readTimestamped(raw),
  };
}

function mapFlareUpForCheckInWriteBody(
  flareUp: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: flareUp.id,
    body_part: flareUp.bodyPart,
    severity: flareUp.severity,
  };
  const classIds = flareUp.likelyCauseActivityClassIds;
  if (Array.isArray(classIds) && classIds.length > 0) {
    body.activity_class_id = classIds[0];
  }
  if (flareUp.notes !== undefined) {
    body.notes = flareUp.notes;
  }
  return body;
}

export function mapDailyCheckInCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const { flareUp, ...rest } = draft;
  const body = mapKeysToSnake(rest, { omitUndefined: true });
  if (isRecord(flareUp)) {
    body.flare_up = mapFlareUpForCheckInWriteBody(flareUp);
  }
  return body;
}

export function mapDailyCheckInPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapDailyCheckInCreateBody(draft);
}

// ---------------------------------------------------------------------------
// Flare-up incidents
// ---------------------------------------------------------------------------

export function mapFlareUpIncidentFromApi(
  raw: Record<string, unknown>,
): WithoutUserId<FlareUpIncident> {
  return {
    id: String(raw.id),
    incidentDate: String(raw.incident_date) as ISODate,
    bodyPart: String(raw.body_part),
    severity: Number(raw.severity) as Score0to10,
    activityClassId: (raw.activity_class_id as string | null) ?? undefined,
    dailyCheckInId: (raw.daily_check_in_id as string | null) ?? undefined,
    notes: (raw.notes as string | null) ?? undefined,
    ...readTimestamped(raw),
  };
}

export function mapFlareUpIncidentCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapFlareUpIncidentPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

// ---------------------------------------------------------------------------
// Activity classes & activities
// ---------------------------------------------------------------------------

export function mapActivityClassFromApi(
  raw: Record<string, unknown>,
): WithoutUserId<ActivityClass> {
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: (raw.description as string | null) ?? undefined,
    type: raw.type as ActivityClass['type'],
    defaultRecoveryWindowDays: Number(raw.default_recovery_window_days),
    ...readTimestamped(raw),
  };
}

export function mapActivityClassCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapActivityClassPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapActivityFromApi(raw: Record<string, unknown>): WithoutUserId<Activity> {
  return {
    id: String(raw.id),
    activityClassId: String(raw.activity_class_id),
    name: String(raw.name),
    type: raw.type as Activity['type'],
    defaultVolumeUnit: (raw.default_volume_unit as VolumeUnit | null) ?? undefined,
    isActive: Boolean(raw.is_active),
    ...readTimestamped(raw),
  };
}

export function mapActivityCreateBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapActivityPatchBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

// ---------------------------------------------------------------------------
// Training blocks, rules, targets, goals
// ---------------------------------------------------------------------------

export function mapTrainingBlockFromApi(
  raw: Record<string, unknown>,
): WithoutUserId<TrainingBlock> {
  return {
    id: String(raw.id),
    name: String(raw.name),
    startDate: String(raw.start_date) as ISODate,
    endDate: (raw.end_date as ISODate | null) ?? undefined,
    status: raw.status as TrainingBlock['status'],
    relatedGoalId: (raw.related_goal_id as string | null) ?? undefined,
    notes: (raw.notes as string | null) ?? undefined,
    isReviewMilestoneHit: Boolean(raw.is_review_milestone_hit),
    ...readTimestamped(raw),
  };
}

export function mapTrainingBlockCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapTrainingBlockPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapRuleFromApi(raw: Record<string, unknown>): Rule {
  return {
    id: String(raw.id),
    trainingBlockId: String(raw.training_block_id),
    activityClassId: (raw.activity_class_id as string | null) ?? null,
    activityId: (raw.activity_id as string | null) ?? undefined,
    ruleType: raw.rule_type as RuleType,
    thresholdValue: Number(raw.threshold_value),
    windowDays: Number(raw.window_days),
    limitUnit: (raw.limit_unit as Rule['limitUnit']) ?? undefined,
    enabled: Boolean(raw.enabled),
    ...readTimestamped(raw),
  };
}

export function mapRuleCreateBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapRulePatchBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapWeeklyTargetFromApi(raw: Record<string, unknown>): WeeklyTarget {
  return {
    id: String(raw.id),
    trainingBlockId: String(raw.training_block_id),
    activityClassId: String(raw.activity_class_id),
    ...(raw.activity_id != null ? { activityId: String(raw.activity_id) } : {}),
    targetValue: Number(raw.target_value),
    targetUnit: raw.target_unit as VolumeUnit,
    ...readTimestamped(raw),
  };
}

export function mapWeeklyTargetCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapWeeklyTargetPatchBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapRecoveryTargetFromApi(raw: Record<string, unknown>): RecoveryTarget {
  return {
    id: String(raw.id),
    trainingBlockId: String(raw.training_block_id),
    activityId: String(raw.activity_id),
    targetFrequency: Number(raw.target_frequency),
    frequencyUnit: raw.frequency_unit as RecoveryTarget['frequencyUnit'],
    currentStreakDays: Number(raw.current_streak_days),
    ...readTimestamped(raw),
  };
}

export function mapRecoveryTargetCreateBody(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapGoalFromApi(raw: Record<string, unknown>): WithoutUserId<Goal> {
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: (raw.description as string | null) ?? undefined,
    targetDate: String(raw.target_date) as ISODate,
    timeframe: raw.timeframe as Goal['timeframe'],
    activityClassId: (raw.activity_class_id as string | null) ?? undefined,
    activityId: (raw.activity_id as string | null) ?? undefined,
    autoTrackProgress: raw.auto_track_progress === true,
    progressValue: (raw.progress_value as number | null) ?? undefined,
    progressTarget: (raw.progress_target as number | null) ?? undefined,
    progressUnit: (raw.progress_unit as VolumeUnit | null) ?? undefined,
    status: raw.status as Goal['status'],
    ...readTimestamped(raw),
  };
}

export function mapGoalCreateBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

export function mapGoalDashboardRowFromApi(raw: Record<string, unknown>): GoalDashboardRow {
  return {
    goalId: String(raw.goal_id),
    title: String(raw.title),
    status: raw.status as GoalStatus,
    activityId: raw.activity_id == null ? null : String(raw.activity_id),
    progressValue: raw.progress_value == null ? null : Number(raw.progress_value),
    progressTarget: raw.progress_target == null ? null : Number(raw.progress_target),
    progressUnit: raw.progress_unit == null ? null : String(raw.progress_unit),
    fillRatio: raw.fill_ratio == null ? null : Number(raw.fill_ratio),
    isQualitative: Boolean(raw.is_qualitative),
  };
}

export function mapGoalPatchBody(draft: Record<string, unknown>): Record<string, unknown> {
  return mapKeysToSnake(draft, { omitUndefined: true });
}

// ---------------------------------------------------------------------------
// Load / dashboard derived shapes
// ---------------------------------------------------------------------------

function mapActivityClassStatusFromApi(raw: Record<string, unknown>) {
  return {
    activityClassId: String(raw.activity_class_id),
    state: raw.state as SafetyState,
    label: String(raw.label ?? ''),
    reason: String(raw.reason ?? ''),
    lastDoneDate: (raw.last_done_date as ISODate | null) ?? undefined,
    nextSafeDate: (raw.next_safe_date as ISODate | null) ?? undefined,
  };
}

function mapSuggestionFromApi(raw: Record<string, unknown>): Suggestion {
  return {
    id: String(raw.id),
    label: String(raw.label),
    state: raw.state as SafetyState,
    reason: String(raw.reason),
    nextSafeDate: (raw.next_safe_date as ISODate | null) ?? undefined,
    lastDoneDate: (raw.last_done_date as ISODate | null) ?? undefined,
    bucket: raw.bucket == null ? undefined : (raw.bucket as Suggestion['bucket']),
    scope: raw.scope == null ? undefined : (raw.scope as Suggestion['scope']),
    activityClassId:
      raw.activity_class_id == null ? undefined : String(raw.activity_class_id),
    description: raw.description == null ? undefined : String(raw.description),
  };
}

function mapLoadRiskRuleLimitRowFromApi(raw: Record<string, unknown>) {
  const displayMode = raw.display_mode;
  return {
    id: String(raw.id),
    scope: raw.scope as LoadRiskSummary['ruleLimitRows'][number]['scope'],
    ruleId: String(raw.rule_id),
    ruleType: String(raw.rule_type),
    activityClassId: String(raw.activity_class_id),
    className: String(raw.class_name),
    actual: Number(raw.actual),
    limit: Number(raw.limit),
    unit: String(raw.unit),
    state: raw.state as LoadRiskSummary['ruleLimitRows'][number]['state'],
    label: String(raw.label),
    activityId: raw.activity_id == null ? null : String(raw.activity_id),
    activityName: raw.activity_name == null ? null : String(raw.activity_name),
    displayMode:
      displayMode === 'status'
        ? ('status' as const)
        : ('bar' as const),
  };
}

export function mapLoadRiskSummaryFromApi(
  raw: Record<string, unknown> | null | undefined,
): LoadRiskSummary | null {
  if (raw == null) {
    return null;
  }
  const weekDays = raw.week_days;
  const ruleLimitRows = raw.rule_limit_rows;
  return {
    weekDays: Array.isArray(weekDays)
      ? weekDays.map((item) => {
          const day = isRecord(item) ? item : {};
          return {
            date: String(day.date) as ISODate,
            flagged: Boolean(day.flagged),
            state: day.state as LoadRiskSummary['weekDays'][number]['state'],
          };
        })
      : [],
    ruleLimitRows: Array.isArray(ruleLimitRows)
      ? ruleLimitRows.map((item) =>
          mapLoadRiskRuleLimitRowFromApi(isRecord(item) ? item : {}),
        )
      : [],
  };
}

function mapWeeklyProgressFromApi(raw: Record<string, unknown>): WeeklyProgress {
  return {
    weeklyTargetId: String(raw.weekly_target_id),
    activityClassId: String(raw.activity_class_id),
    className: String(raw.class_name),
    activityId: raw.activity_id != null ? String(raw.activity_id) : null,
    activityName: raw.activity_name != null ? String(raw.activity_name) : null,
    value: Number(raw.value),
    target: Number(raw.target),
    unit: raw.unit as WeeklyProgress['unit'],
    state: raw.state as WeeklyProgress['state'],
    periodStart:
      raw.period_start != null ? (String(raw.period_start) as ISODate) : undefined,
    periodEnd: raw.period_end != null ? (String(raw.period_end) as ISODate) : undefined,
  };
}

export function mapDailySafetyScoreFromApi(raw: Record<string, unknown>) {
  const violations = raw.violations;
  return {
    date: String(raw.date) as ISODate,
    state: raw.state as SafetyState | 'neutral',
    violations: Array.isArray(violations)
      ? violations.map((item) => mapRuleViolationFromApi(isRecord(item) ? item : {}))
      : [],
    hadFlareUp: Boolean(raw.had_flare_up),
    painLevel: raw.pain_level != null ? (Number(raw.pain_level) as Score0to10) : undefined,
  };
}

export function mapLoadPointFromApi(raw: Record<string, unknown>): LoadPoint {
  return {
    date: String(raw.date) as ISODate,
    load: Number(raw.load),
    dailyLoad: Number(raw.daily_load),
  };
}

export function mapRecoveryStreakFromApi(raw: Record<string, unknown>): RecoveryStreak {
  return {
    recoveryTargetId: String(raw.recovery_target_id),
    activityId: String(raw.activity_id),
    activityName: String(raw.activity_name),
    activityClassId: String(raw.activity_class_id),
    targetFrequency: Number(raw.target_frequency),
    frequencyUnit: raw.frequency_unit as RecoveryStreak['frequencyUnit'],
    currentStreakDays: Number(raw.current_streak_days),
  };
}

export interface DashboardPayload {
  todayDate: ISODate;
  userName: string;
  block: WithoutUserId<TrainingBlock> | null;
  activityClasses: WithoutUserId<ActivityClass>[];
  activities: WithoutUserId<Activity>[];
  logs: ActivityLogRead[];
  incidents: WithoutUserId<FlareUpIncident>[];
  hasCheckedInToday: boolean;
  classStatuses: ReturnType<typeof mapActivityClassStatusFromApi>[];
  suggestionBuckets: Suggestion[];
  loadRiskSummary: LoadRiskSummary | null;
  weeklyProgress: WeeklyProgress[];
  dailyScores: ReturnType<typeof mapDailySafetyScoreFromApi>[];
  loadSeries: LoadPoint[];
  graphClassId: string | null;
  flareUpDates: ISODate[];
  weekLoadThreshold: number | null;
  cleanStreak: number;
  recoveryStreaks: RecoveryStreak[];
  goals: WithoutUserId<Goal>[];
  goalRows: GoalDashboardRow[];
  previousBlocks: WithoutUserId<TrainingBlock>[];
}

export function mapDashboardFromApi(raw: Record<string, unknown>): DashboardPayload {
  const blockRaw = raw.block;
  const mapList = <T>(
    value: unknown,
    mapper: (item: Record<string, unknown>) => T,
  ): T[] => (Array.isArray(value) ? value.map((item) => mapper(isRecord(item) ? item : {})) : []);

  return {
    todayDate: String(raw.as_of) as ISODate,
    userName: String(raw.user_name),
    block: blockRaw == null ? null : mapTrainingBlockFromApi(isRecord(blockRaw) ? blockRaw : {}),
    activityClasses: mapList(raw.activity_classes, mapActivityClassFromApi),
    activities: mapList(raw.activities, mapActivityFromApi),
    logs: mapList(raw.logs, mapActivityLogFromApi),
    incidents: mapList(raw.incidents, mapFlareUpIncidentFromApi),
    hasCheckedInToday: Boolean(raw.has_checked_in_today),
    classStatuses: mapList(raw.class_statuses, mapActivityClassStatusFromApi),
    suggestionBuckets: mapList(raw.suggestion_buckets, mapSuggestionFromApi),
    loadRiskSummary: mapLoadRiskSummaryFromApi(
      raw.load_risk_summary == null
        ? null
        : isRecord(raw.load_risk_summary)
          ? raw.load_risk_summary
          : {},
    ),
    weeklyProgress: mapList(raw.weekly_progress, mapWeeklyProgressFromApi),
    dailyScores: mapList(raw.daily_scores, mapDailySafetyScoreFromApi),
    loadSeries: mapList(raw.load_series, mapLoadPointFromApi),
    graphClassId:
      raw.graph_class_id == null ? null : String(raw.graph_class_id),
    flareUpDates: Array.isArray(raw.flare_up_dates)
      ? raw.flare_up_dates.map((date) => String(date) as ISODate)
      : [],
    weekLoadThreshold:
      raw.week_load_threshold == null ? null : Number(raw.week_load_threshold),
    cleanStreak: Number(raw.clean_streak),
    recoveryStreaks: mapList(raw.recovery_streaks, mapRecoveryStreakFromApi),
    goals: mapList(raw.goals, mapGoalFromApi),
    goalRows: mapList(raw.goal_rows, mapGoalDashboardRowFromApi),
    previousBlocks: mapList(raw.previous_blocks, mapTrainingBlockFromApi),
  };
}

export function mapLoadSummaryFromApi(raw: Record<string, unknown>) {
  return {
    asOf: String(raw.as_of) as ISODate,
    classStatuses: Array.isArray(raw.class_statuses)
      ? raw.class_statuses.map((item) =>
          mapActivityClassStatusFromApi(isRecord(item) ? item : {}),
        )
      : [],
    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.map((item) => mapSuggestionFromApi(isRecord(item) ? item : {}))
      : [],
    weeklyProgress: Array.isArray(raw.weekly_progress)
      ? raw.weekly_progress.map((item) => mapWeeklyProgressFromApi(isRecord(item) ? item : {}))
      : [],
  };
}

export function mapCheckViolationsRequestBody(input: {
  activityId: string;
  volumeValue: number;
  rpe: number;
  asOf?: ISODate;
  durationMinutes?: number;
  volumeUnit?: string;
}): Record<string, unknown> {
  return {
    activity_id: input.activityId,
    volume_value: input.volumeValue,
    rpe: input.rpe,
    ...(input.asOf !== undefined ? { as_of: input.asOf } : {}),
    ...(input.durationMinutes !== undefined
      ? { duration_minutes: input.durationMinutes }
      : {}),
    ...(input.volumeUnit !== undefined ? { volume_unit: input.volumeUnit } : {}),
  };
}

export function mapCheckViolationsResponseFromApi(raw: Record<string, unknown>): {
  violations: RuleViolationSnapshot[];
} {
  const violations = raw.violations;
  return {
    violations: Array.isArray(violations)
      ? violations.map((item) => mapRuleViolationFromApi(isRecord(item) ? item : {}))
      : [],
  };
}

export function mapDelayedTaxHitFromApi(raw: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    mapped[snakeToCamel(key)] = value;
  }
  return mapped;
}

export function mapDelayedTaxResponseFromApi(raw: Record<string, unknown>) {
  const hits = raw.hits;
  return {
    asOf: String(raw.as_of) as ISODate,
    riskWindowDays: Number(raw.risk_window_days),
    baselineDays: Number(raw.baseline_days),
    painThreshold: Number(raw.pain_threshold),
    hits: Array.isArray(hits)
      ? hits.map((item) => mapDelayedTaxHitFromApi(isRecord(item) ? item : {}))
      : [],
  };
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export { buildQuery };
