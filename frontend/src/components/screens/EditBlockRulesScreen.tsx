import * as React from 'react';
import { cn } from '../../lib/cn';
import { BackButton } from '../ui/BackButton';
import { Card } from '../ui/Card';
import { StackScreenEngineBody } from '../ui/StackScreenEngineBody';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import type {
  Activity,
  ActivityClass,
  Rule,
  RuleType,
  VolumeCapUnit,
  VolumeUnit,
  WeeklyTarget,
} from '../../types';
import {
  CLASS_ADD_RULE_TYPES,
  EXERCISE_ADD_RULE_TYPES,
  VOLUME_CAP_UNITS,
  getRuleHelper,
  getRuleLabel,
  isVolumeCapRule,
} from '../../lib/ruleTaxonomy';

export interface EditBlockRulesScreenProps {
  engine: MilestoneEngineResult;
  onBack: () => void;
}

interface RuleDefinition {
  label: string;
  unit: string;
  min: number;
  step: number;
}

const CLASS_RULE_TYPE_OPTIONS = CLASS_ADD_RULE_TYPES.map((value) => ({
  value,
  label: getRuleLabel(value),
}));

const EXERCISE_RULE_TYPE_OPTIONS = EXERCISE_ADD_RULE_TYPES.map((value) => ({
  value,
  label: getRuleLabel(value),
}));

const WEEKLY_TARGET_UNITS: VolumeUnit[] = ['km', 'mi', 'm', 'minutes', 'sessions', 'reps', 'sets'];

const RULE_DEFINITIONS: Record<RuleType, RuleDefinition> = {
  rest_between_class: {
    label: getRuleLabel('rest_between_class'),
    unit: 'days',
    min: 1,
    step: 1,
  },
  frequency_limit: {
    label: getRuleLabel('frequency_limit'),
    unit: '×/wk',
    min: 1,
    step: 1,
  },
  weekly_load_cap: {
    label: getRuleLabel('weekly_load_cap'),
    unit: 'load',
    min: 10,
    step: 1,
  },
  consecutive_day_limit: {
    label: getRuleLabel('consecutive_day_limit'),
    unit: 'days',
    min: 1,
    step: 1,
  },
  weekly_volume_cap: {
    label: getRuleLabel('weekly_volume_cap'),
    unit: 'volume',
    min: 1,
    step: 1,
  },
  daily_volume_cap: {
    label: getRuleLabel('daily_volume_cap'),
    unit: 'volume',
    min: 1,
    step: 1,
  },
  weekly_activity_count: {
    label: 'Max sessions per week',
    unit: 'sessions',
    min: 1,
    step: 1,
  },
};

const DEFAULT_NEW_RULE_DRAFT: Pick<RuleDraft, 'ruleType' | 'thresholdValue'> = {
  ruleType: 'rest_between_class',
  thresholdValue: 1,
};

function sortClassesForRules(classes: ActivityClass[]): ActivityClass[] {
  return [...classes].sort((left, right) => {
    if (left.type === right.type) {
      return left.name.localeCompare(right.name);
    }
    return left.type === 'performance' ? -1 : 1;
  });
}

function isClassLevelRule(rule: Rule): boolean {
  return rule.activityId == null;
}

function isExerciseRule(rule: Rule): boolean {
  return rule.activityId != null;
}

function getClassLevelRules(rules: Rule[], classId: string): Rule[] {
  return rules.filter(
    (rule) => rule.activityClassId === classId && isClassLevelRule(rule),
  );
}

function getExerciseRules(rules: Rule[], classId: string): Rule[] {
  return rules.filter(
    (rule) => rule.activityClassId === classId && isExerciseRule(rule),
  );
}

function getWeeklyTargetForClass(
  weeklyTargets: WeeklyTarget[],
  classId: string,
): WeeklyTarget | undefined {
  return weeklyTargets.find((target) => target.activityClassId === classId);
}

function clampThreshold(value: number, definition: RuleDefinition): number {
  return Math.max(definition.min, value);
}

function formatThreshold(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function defaultLimitUnitForRule(ruleType: RuleType): VolumeCapUnit {
  return ruleType === 'daily_volume_cap' ? 'minutes' : 'km';
}

function windowDaysForRuleType(ruleType: RuleType): number {
  return ruleType === 'daily_volume_cap' ? 1 : 7;
}

function parseDisplayedThreshold(
  displayedValue: string,
  fallbackValue: number,
): number {
  const parsedValue = Number(displayedValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

interface RuleRowProps {
  rule: Rule;
  activityName?: string;
  indented?: boolean;
  draftThresholds: Record<string, string>;
  onDraftChange: (ruleId: string, value: string) => void;
  onCommitThreshold: (rule: Rule, value: number) => void;
  onCommitDraft: (rule: Rule) => void;
  onLimitUnitChange: (rule: Rule, limitUnit: VolumeCapUnit) => void;
  onToggleEnabled: (rule: Rule) => void;
  onDelete: (ruleId: string) => void;
}

function RuleRow({
  rule,
  activityName,
  indented = false,
  draftThresholds,
  onDraftChange,
  onCommitThreshold,
  onCommitDraft,
  onLimitUnitChange,
  onToggleEnabled,
  onDelete,
}: RuleRowProps): React.ReactElement {
  const definition = RULE_DEFINITIONS[rule.ruleType];
  const inputId = `rule-threshold-${rule.id}`;
  const thresholdValue = draftThresholds[rule.id] ?? formatThreshold(rule.thresholdValue);
  const helperText = getRuleHelper(rule.ruleType);
  const showVolumeUnit = isVolumeCapRule(rule.ruleType);
  const displayUnit = showVolumeUnit
    ? (rule.limitUnit ?? defaultLimitUnitForRule(rule.ruleType))
    : definition.unit;

  return (
    <div className={cn('px-4 py-3.5', indented && 'pl-8')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={inputId}
            className="text-body font-medium text-ink"
          >
            {activityName ?? definition.label}
          </label>
          {activityName != null ? (
            <p className="mt-0.5 text-caption text-ink-muted">{definition.label}</p>
          ) : null}
          {helperText != null ? (
            <p className="mt-1 text-caption text-ink-muted">{helperText}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="text-caption font-medium text-danger-fg hover:underline"
          >
            Delete
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={rule.enabled}
            aria-label={`${definition.label} enabled`}
            onClick={() => onToggleEnabled(rule)}
            className={cn(
              'relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center overflow-hidden rounded-full transition-colors duration-snap',
              rule.enabled ? 'bg-safe-fg' : 'bg-border-strong',
            )}
          >
            <span
              className={cn(
                'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-snap',
                rule.enabled ? 'translate-x-5' : 'translate-x-1',
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {rule.enabled ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Decrease ${definition.label}`}
            onClick={() =>
              onCommitThreshold(
                rule,
                parseDisplayedThreshold(thresholdValue, rule.thresholdValue) - definition.step,
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-sunken text-body-lg font-medium text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
          >
            -
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            <input
              id={inputId}
              type="number"
              min={definition.min}
              step={definition.step}
              value={thresholdValue}
              onChange={(event) => onDraftChange(rule.id, event.target.value)}
              onBlur={() => onCommitDraft(rule)}
              className="w-16 rounded-md border border-border bg-bg-sunken px-2 py-1.5 text-center text-body-lg font-semibold tabular-nums text-ink outline-none"
            />
            {showVolumeUnit ? (
              <select
                value={rule.limitUnit ?? defaultLimitUnitForRule(rule.ruleType)}
                aria-label="Volume unit"
                onChange={(event) =>
                  onLimitUnitChange(rule, event.target.value as VolumeCapUnit)
                }
                className="rounded-md border border-border bg-bg-sunken px-2 py-1.5 text-caption text-ink"
              >
                {VOLUME_CAP_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 text-caption text-ink-faint">
                {displayUnit}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={`Increase ${definition.label}`}
            onClick={() =>
              onCommitThreshold(
                rule,
                parseDisplayedThreshold(thresholdValue, rule.thresholdValue) + definition.step,
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-sunken text-body-lg font-medium text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
          >
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface WeeklyTargetEditorProps {
  weeklyTarget: WeeklyTarget;
  onPatch: (targetId: string, patch: { targetValue?: number; targetUnit?: VolumeUnit }) => void;
}

function WeeklyTargetEditor({
  weeklyTarget,
  onPatch,
}: WeeklyTargetEditorProps): React.ReactElement {
  const [draftValue, setDraftValue] = React.useState(String(weeklyTarget.targetValue));
  const [draftUnit, setDraftUnit] = React.useState<VolumeUnit>(weeklyTarget.targetUnit);

  React.useEffect(() => {
    setDraftValue(String(weeklyTarget.targetValue));
    setDraftUnit(weeklyTarget.targetUnit);
  }, [weeklyTarget.targetValue, weeklyTarget.targetUnit]);

  function commitValue(): void {
    const parsedValue = Number(draftValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setDraftValue(String(weeklyTarget.targetValue));
      return;
    }
    if (parsedValue !== weeklyTarget.targetValue) {
      onPatch(weeklyTarget.id, { targetValue: parsedValue });
    }
  }

  function commitUnit(nextUnit: VolumeUnit): void {
    setDraftUnit(nextUnit);
    if (nextUnit !== weeklyTarget.targetUnit) {
      onPatch(weeklyTarget.id, { targetUnit: nextUnit });
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input
        type="number"
        min={1}
        step={1}
        value={draftValue}
        aria-label="Weekly goal"
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={commitValue}
        className="w-20 rounded-md border border-border bg-bg-sunken px-2 py-1.5 text-center text-body-lg font-semibold tabular-nums text-ink outline-none"
      />
      <select
        value={draftUnit}
        aria-label="Weekly goal unit"
        onChange={(event) => commitUnit(event.target.value as VolumeUnit)}
        className="rounded-md border border-border bg-bg-sunken px-2 py-1.5 text-body text-ink"
      >
        {WEEKLY_TARGET_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </div>
  );
}

interface AddRuleFormProps {
  ruleTypeOptions: { value: RuleType; label: string }[];
  showActivityPicker?: boolean;
  activities?: Activity[];
  selectedActivityId?: string;
  onActivityChange?: (activityId: string) => void;
  onSave: (
    ruleType: RuleType,
    thresholdValue: number,
    activityId?: string,
    limitUnit?: VolumeCapUnit,
  ) => void;
  onCancel: () => void;
  mutationError?: string | null;
}

function RuleMutationAlert({
  message,
}: {
  message: string;
}): React.ReactElement {
  return (
    <p role="alert" className="text-body-sm text-danger-fg">
      {message}
    </p>
  );
}

function AddRuleForm({
  ruleTypeOptions,
  showActivityPicker = false,
  activities = [],
  selectedActivityId = '',
  onActivityChange,
  onSave,
  onCancel,
  mutationError = null,
}: AddRuleFormProps): React.ReactElement {
  const [ruleType, setRuleType] = React.useState<RuleType>(DEFAULT_NEW_RULE_DRAFT.ruleType);
  const [threshold, setThreshold] = React.useState(String(DEFAULT_NEW_RULE_DRAFT.thresholdValue));
  const [activityId, setActivityId] = React.useState(selectedActivityId);
  const [limitUnit, setLimitUnit] = React.useState<VolumeCapUnit>(
    defaultLimitUnitForRule(DEFAULT_NEW_RULE_DRAFT.ruleType),
  );
  const helperText = getRuleHelper(ruleType);
  const showVolumeUnit = isVolumeCapRule(ruleType);

  React.useEffect(() => {
    setActivityId(selectedActivityId);
  }, [selectedActivityId]);

  function handleSave(): void {
    const parsedThreshold = Number(threshold);
    if (!Number.isFinite(parsedThreshold)) {
      return;
    }
    if (showActivityPicker && activityId === '') {
      return;
    }
    const definition = RULE_DEFINITIONS[ruleType];
    onSave(
      ruleType,
      clampThreshold(parsedThreshold, definition),
      activityId || undefined,
      showVolumeUnit ? limitUnit : undefined,
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">
      {showActivityPicker ? (
        <div>
          <label
            htmlFor="new-exercise-activity"
            className="mb-1 block text-caption text-ink-muted"
          >
            Exercise
          </label>
          <select
            id="new-exercise-activity"
            value={activityId}
            aria-label="Exercise"
            onChange={(event) => {
              setActivityId(event.target.value);
              onActivityChange?.(event.target.value);
            }}
            className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
          >
            <option value="">Select exercise…</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label
          htmlFor="new-rule-type"
          className="mb-1 block text-body font-medium text-ink"
        >
          Rule type
        </label>
        <select
          id="new-rule-type"
          value={ruleType}
          onChange={(event) => {
            const nextRuleType = event.target.value as RuleType;
            setRuleType(nextRuleType);
            if (isVolumeCapRule(nextRuleType)) {
              setLimitUnit(defaultLimitUnitForRule(nextRuleType));
            }
          }}
          aria-label="Rule type"
          className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
        >
          {ruleTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {helperText != null ? (
          <p className="mt-1.5 text-caption text-ink-muted">{helperText}</p>
        ) : null}
      </div>
      <div>
        <label
          htmlFor="new-rule-threshold"
          className="mb-1 block text-caption text-ink-muted"
        >
          {RULE_DEFINITIONS[ruleType].label}
        </label>
        <input
          id="new-rule-threshold"
          type="number"
          min={RULE_DEFINITIONS[ruleType].min}
          step={RULE_DEFINITIONS[ruleType].step}
          value={threshold}
          aria-label="Threshold"
          onChange={(event) => setThreshold(event.target.value)}
          className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
        />
      </div>
      {showVolumeUnit ? (
        <div>
          <label
            htmlFor="new-rule-volume-unit"
            className="mb-1 block text-caption text-ink-muted"
          >
            Volume unit
          </label>
          <select
            id="new-rule-volume-unit"
            value={limitUnit}
            aria-label="Volume unit"
            onChange={(event) => setLimitUnit(event.target.value as VolumeCapUnit)}
            className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
          >
            {VOLUME_CAP_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {mutationError != null ? <RuleMutationAlert message={mutationError} /> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="h-11 flex-1 rounded-md bg-ink text-body-lg font-semibold text-ink-inverse transition-colors duration-snap active:opacity-80"
        >
          Save
        </button>
      </div>
    </div>
  );
}

interface ClassRulesSectionProps {
  activityClass: ActivityClass;
  classRules: Rule[];
  exerciseRules: Rule[];
  weeklyTarget: WeeklyTarget | undefined;
  classActivities: Activity[];
  draftThresholds: Record<string, string>;
  addingClassCap: boolean;
  addingExerciseRule: boolean;
  onDraftChange: (ruleId: string, value: string) => void;
  onCommitThreshold: (rule: Rule, value: number) => void;
  onCommitDraft: (rule: Rule) => void;
  onLimitUnitChange: (rule: Rule, limitUnit: VolumeCapUnit) => void;
  onToggleEnabled: (rule: Rule) => void;
  onDeleteRule: (ruleId: string) => void;
  onPatchWeeklyTarget: (targetId: string, patch: { targetValue?: number; targetUnit?: VolumeUnit }) => void;
  onCreateWeeklyTarget: (classId: string) => void;
  onAddClassCap: () => void;
  onCancelClassCap: () => void;
  onConfirmClassCap: (ruleType: RuleType, thresholdValue: number) => void;
  onAddExerciseRule: () => void;
  onCancelExerciseRule: () => void;
  onConfirmExerciseRule: (
    ruleType: RuleType,
    thresholdValue: number,
    activityId: string,
    limitUnit?: VolumeCapUnit,
  ) => void;
  activityNameById: Map<string, string>;
  ruleMutationError: string | null;
}

function ClassRulesSection({
  activityClass,
  classRules,
  exerciseRules,
  weeklyTarget,
  classActivities,
  draftThresholds,
  addingClassCap,
  addingExerciseRule,
  onDraftChange,
  onCommitThreshold,
  onCommitDraft,
  onLimitUnitChange,
  onToggleEnabled,
  onDeleteRule,
  onPatchWeeklyTarget,
  onCreateWeeklyTarget,
  onAddClassCap,
  onCancelClassCap,
  onConfirmClassCap,
  onAddExerciseRule,
  onCancelExerciseRule,
  onConfirmExerciseRule,
  activityNameById,
  ruleMutationError,
}: ClassRulesSectionProps): React.ReactElement {
  const showWeeklyGoal =
    activityClass.type === 'performance' || weeklyTarget != null;

  return (
    <section
      data-testid={`class-rules-${activityClass.id}`}
      className="flex flex-col gap-3"
    >
      <h2 className="text-title-sm font-semibold text-ink">{activityClass.name}</h2>

      <div>
        <h3 className="mb-1.5 text-label font-medium uppercase text-ink-faint">Caps</h3>
        <Card pad="none">
          {classRules.length === 0 && !addingClassCap ? (
            <p className="px-4 py-3 text-body-sm text-ink-muted">
              No limits — unlimited for this class.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {classRules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  draftThresholds={draftThresholds}
                  onDraftChange={onDraftChange}
                  onCommitThreshold={onCommitThreshold}
                  onCommitDraft={onCommitDraft}
                  onLimitUnitChange={onLimitUnitChange}
                  onToggleEnabled={onToggleEnabled}
                  onDelete={onDeleteRule}
                />
              ))}
            </div>
          )}
          {addingClassCap ? (
            <AddRuleForm
              ruleTypeOptions={CLASS_RULE_TYPE_OPTIONS}
              mutationError={ruleMutationError}
              onSave={(ruleType, thresholdValue) => onConfirmClassCap(ruleType, thresholdValue)}
              onCancel={onCancelClassCap}
            />
          ) : null}
          {!addingClassCap ? (
            <div className="border-t border-border-subtle px-4 py-2">
              <button
                type="button"
                onClick={onAddClassCap}
                className="text-body text-ink-muted transition-colors hover:text-ink"
              >
                + Add class cap
              </button>
            </div>
          ) : null}
        </Card>
      </div>

      {showWeeklyGoal ? (
        <div>
          <h3 className="mb-1.5 text-label font-medium uppercase text-ink-faint">Weekly goal</h3>
          <Card pad="none">
            {weeklyTarget != null ? (
              <WeeklyTargetEditor
                weeklyTarget={weeklyTarget}
                onPatch={onPatchWeeklyTarget}
              />
            ) : (
              <div className="px-4 py-3">
                <p className="mb-2 text-body-sm text-ink-muted">No weekly goal set.</p>
                <button
                  type="button"
                  onClick={() => onCreateWeeklyTarget(activityClass.id)}
                  className="text-body text-ink-muted transition-colors hover:text-ink"
                >
                  + Add weekly goal
                </button>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      <div>
        <h3 className="mb-1.5 text-label font-medium uppercase text-ink-faint">Exercises</h3>
        <Card pad="none">
          {exerciseRules.length === 0 && !addingExerciseRule ? (
            <p className="px-4 py-3 text-body-sm text-ink-muted">
              No exercise-specific rules.
            </p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {exerciseRules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  indented
                  activityName={
                    rule.activityId != null
                      ? activityNameById.get(rule.activityId) ?? 'Unknown exercise'
                      : undefined
                  }
                  draftThresholds={draftThresholds}
                  onDraftChange={onDraftChange}
                  onCommitThreshold={onCommitThreshold}
                  onCommitDraft={onCommitDraft}
                  onLimitUnitChange={onLimitUnitChange}
                  onToggleEnabled={onToggleEnabled}
                  onDelete={onDeleteRule}
                />
              ))}
            </div>
          )}
          {addingExerciseRule ? (
            <AddRuleForm
              ruleTypeOptions={EXERCISE_RULE_TYPE_OPTIONS}
              showActivityPicker
              activities={classActivities}
              mutationError={ruleMutationError}
              onSave={(ruleType, thresholdValue, activityId, limitUnit) => {
                if (activityId != null) {
                  onConfirmExerciseRule(ruleType, thresholdValue, activityId, limitUnit);
                }
              }}
              onCancel={onCancelExerciseRule}
            />
          ) : null}
          {!addingExerciseRule ? (
            <div className="border-t border-border-subtle px-4 py-2">
              <button
                type="button"
                onClick={onAddExerciseRule}
                className="text-body text-ink-muted transition-colors hover:text-ink"
              >
                + Add exercise rule
              </button>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

export function EditBlockRulesScreen({
  engine,
  onBack,
}: EditBlockRulesScreenProps): React.ReactElement {
  const [draftThresholds, setDraftThresholds] = React.useState<Record<string, string>>({});
  const [addingClassCapClassId, setAddingClassCapClassId] = React.useState<string | null>(null);
  const [addingExerciseRuleClassId, setAddingExerciseRuleClassId] = React.useState<string | null>(null);
  const classCapBaselineCountRef = React.useRef(0);
  const exerciseRuleBaselineCountRef = React.useRef(0);

  const sortedClasses = sortClassesForRules(engine.activityClasses);
  const scopedRules = engine.rules.filter((rule) => rule.activityClassId != null);
  const activityNameById = new Map(
    engine.activities.map((activity) => [activity.id, activity.name]),
  );

  React.useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const rule of engine.rules) {
      if (rule.activityClassId == null) {
        continue;
      }
      nextDrafts[rule.id] = formatThreshold(rule.thresholdValue);
    }
    setDraftThresholds(nextDrafts);
  }, [engine.rules]);

  React.useEffect(() => {
    if (addingClassCapClassId == null || engine.ruleMutationError != null) {
      return;
    }
    const currentCount = getClassLevelRules(scopedRules, addingClassCapClassId).length;
    if (currentCount > classCapBaselineCountRef.current) {
      setAddingClassCapClassId(null);
    }
  }, [addingClassCapClassId, engine.ruleMutationError, scopedRules]);

  React.useEffect(() => {
    if (addingExerciseRuleClassId == null || engine.ruleMutationError != null) {
      return;
    }
    const currentCount = getExerciseRules(scopedRules, addingExerciseRuleClassId).length;
    if (currentCount > exerciseRuleBaselineCountRef.current) {
      setAddingExerciseRuleClassId(null);
    }
  }, [addingExerciseRuleClassId, engine.ruleMutationError, scopedRules]);

  function updateDraftThreshold(ruleId: string, value: string): void {
    setDraftThresholds((previous) => ({
      ...previous,
      [ruleId]: value,
    }));
  }

  function commitThreshold(rule: Rule, value: number): void {
    const definition = RULE_DEFINITIONS[rule.ruleType];
    const thresholdValue = clampThreshold(value, definition);
    updateDraftThreshold(rule.id, formatThreshold(thresholdValue));
    engine.updateRule(rule.id, { thresholdValue });
  }

  function commitDraftThreshold(rule: Rule): void {
    const draftValue = draftThresholds[rule.id] ?? formatThreshold(rule.thresholdValue);
    const parsedValue = Number(draftValue);
    if (!Number.isFinite(parsedValue)) {
      updateDraftThreshold(rule.id, formatThreshold(rule.thresholdValue));
      return;
    }
    commitThreshold(rule, parsedValue);
  }

  function confirmClassCap(
    classId: string,
    ruleType: RuleType,
    thresholdValue: number,
  ): void {
    engine.createRule({
      activityClassId: classId,
      ruleType,
      thresholdValue,
      windowDays: 7,
      enabled: true,
    });
  }

  function confirmExerciseRule(
    classId: string,
    ruleType: RuleType,
    thresholdValue: number,
    activityId: string,
    limitUnit?: VolumeCapUnit,
  ): void {
    engine.createRule({
      activityClassId: classId,
      activityId,
      ruleType,
      thresholdValue,
      windowDays: windowDaysForRuleType(ruleType),
      limitUnit: isVolumeCapRule(ruleType) ? limitUnit : undefined,
      enabled: true,
    });
  }

  function cancelClassCap(): void {
    engine.clearRuleMutationError();
    setAddingClassCapClassId(null);
  }

  function cancelExerciseRule(): void {
    engine.clearRuleMutationError();
    setAddingExerciseRuleClassId(null);
  }

  function handleLimitUnitChange(rule: Rule, limitUnit: VolumeCapUnit): void {
    engine.updateRule(rule.id, { limitUnit });
  }

  function handleCreateWeeklyTarget(classId: string): void {
    engine.createWeeklyTarget({
      activityClassId: classId,
      targetValue: 10,
      targetUnit: 'km',
    });
  }

  return (
    <section className="flex min-h-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3">
        <BackButton onPress={onBack} />
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-bold text-ink">Edit Rules</h1>
          <p className="truncate text-body-sm text-ink-muted">{engine.block.name}</p>
        </div>
      </header>

      <StackScreenEngineBody engine={engine}>
        <div className="flex flex-1 flex-col gap-6 px-4 py-5 pb-12">
          {sortedClasses.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
              <p className="text-body-md text-ink-muted">
                No activity classes configured for this block.
              </p>
            </div>
          ) : (
            sortedClasses.map((activityClass) => {
              const classActivities = engine.activities.filter(
                (activity) =>
                  activity.activityClassId === activityClass.id && activity.isActive,
              );

              return (
                <ClassRulesSection
                  key={activityClass.id}
                  activityClass={activityClass}
                  classRules={getClassLevelRules(scopedRules, activityClass.id)}
                  exerciseRules={getExerciseRules(scopedRules, activityClass.id)}
                  weeklyTarget={getWeeklyTargetForClass(engine.weeklyTargets, activityClass.id)}
                  classActivities={classActivities}
                  draftThresholds={draftThresholds}
                  addingClassCap={addingClassCapClassId === activityClass.id}
                  addingExerciseRule={addingExerciseRuleClassId === activityClass.id}
                  onDraftChange={updateDraftThreshold}
                  onCommitThreshold={commitThreshold}
                  onCommitDraft={commitDraftThreshold}
                  onLimitUnitChange={handleLimitUnitChange}
                  onToggleEnabled={(rule) =>
                    engine.updateRule(rule.id, { enabled: !rule.enabled })
                  }
                  onDeleteRule={(ruleId) => engine.deleteRule(ruleId)}
                  onPatchWeeklyTarget={(targetId, patch) =>
                    engine.patchWeeklyTarget(targetId, patch)
                  }
                  onCreateWeeklyTarget={handleCreateWeeklyTarget}
                  onAddClassCap={() => {
                    setAddingExerciseRuleClassId(null);
                    classCapBaselineCountRef.current = getClassLevelRules(
                      scopedRules,
                      activityClass.id,
                    ).length;
                    setAddingClassCapClassId(activityClass.id);
                  }}
                  onCancelClassCap={cancelClassCap}
                  onConfirmClassCap={(ruleType, thresholdValue) =>
                    confirmClassCap(activityClass.id, ruleType, thresholdValue)
                  }
                  onAddExerciseRule={() => {
                    setAddingClassCapClassId(null);
                    exerciseRuleBaselineCountRef.current = getExerciseRules(
                      scopedRules,
                      activityClass.id,
                    ).length;
                    setAddingExerciseRuleClassId(activityClass.id);
                  }}
                  onCancelExerciseRule={cancelExerciseRule}
                  onConfirmExerciseRule={(ruleType, thresholdValue, activityId, limitUnit) =>
                    confirmExerciseRule(
                      activityClass.id,
                      ruleType,
                      thresholdValue,
                      activityId,
                      limitUnit,
                    )
                  }
                  activityNameById={activityNameById}
                  ruleMutationError={engine.ruleMutationError}
                />
              );
            })
          )}
        </div>
      </StackScreenEngineBody>
    </section>
  );
}
