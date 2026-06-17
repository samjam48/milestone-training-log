import * as React from 'react';
import { cn } from '../../lib/cn';
import { BackButton } from '../ui/BackButton';
import { Card } from '../ui/Card';
import { DeleteButton } from '../ui/DeleteButton';
import { StackScreenEngineBody } from '../ui/StackScreenEngineBody';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import type {
  Activity,
  ActivityClass,
  Rule,
  RuleType,
  VolumeCapUnit,
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
  const helperId = `rule-helper-${rule.id}`;
  const thresholdValue = draftThresholds[rule.id] ?? formatThreshold(rule.thresholdValue);
  const helperText = getRuleHelper(rule.ruleType);
  const showVolumeUnit = isVolumeCapRule(rule.ruleType);
  const displayUnit = showVolumeUnit
    ? (rule.limitUnit ?? defaultLimitUnitForRule(rule.ruleType))
    : definition.unit;
  const rowLabel = activityName ?? definition.label;
  const [isHelperOpen, setIsHelperOpen] = React.useState(false);

  return (
    <div className={cn('px-3 py-2.5', indented && 'pl-8')}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="relative flex min-w-0 flex-1 basis-0 flex-wrap items-center gap-1">
          <label
            htmlFor={inputId}
            className={cn(
              'block min-w-0 truncate text-body font-medium',
              rule.enabled ? 'text-ink' : 'text-ink-muted',
            )}
          >
            {rowLabel}
          </label>
          {activityName != null ? (
            <p className="order-last w-full truncate text-caption text-ink-muted">
              {definition.label}
            </p>
          ) : null}

          {helperText != null ? (
            <button
              type="button"
              aria-label={`${definition.label} info`}
              aria-describedby={isHelperOpen ? helperId : undefined}
              title={helperText}
              onClick={() => setIsHelperOpen((current) => !current)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
            >
              i
            </button>
          ) : null}

          {isHelperOpen ? (
            <p
              id={helperId}
              className="absolute left-0 top-9 z-10 w-56 rounded-md border border-border bg-bg-raised px-3 py-2 text-caption text-ink-muted shadow-card"
            >
              {helperText}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`${definition.label} enabled`}
          onClick={() => onToggleEnabled(rule)}
          className={cn(
            'relative inline-flex h-6 w-10 shrink-0 items-center overflow-hidden rounded-full transition-colors duration-snap',
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

      <div className="mt-2 grid w-full min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1">
        <span aria-hidden="true" className="min-h-11 min-w-11" />

        {rule.enabled ? (
          <div className="mx-auto flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              aria-label={`Decrease ${definition.label}`}
              onClick={() =>
                onCommitThreshold(
                  rule,
                  parseDisplayedThreshold(thresholdValue, rule.thresholdValue) - definition.step,
                )
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-sunken text-body font-medium text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
            >
              -
            </button>
            <input
              id={inputId}
              type="number"
              min={definition.min}
              step={definition.step}
              value={thresholdValue}
              onChange={(event) => onDraftChange(rule.id, event.target.value)}
              onBlur={() => onCommitDraft(rule)}
              className="w-12 appearance-none rounded-md border border-border bg-bg-sunken px-1.5 py-1 text-center text-body font-semibold tabular-nums text-ink outline-none"
            />
            <button
              type="button"
              aria-label={`Increase ${definition.label}`}
              onClick={() =>
                onCommitThreshold(
                  rule,
                  parseDisplayedThreshold(thresholdValue, rule.thresholdValue) + definition.step,
                )
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-sunken text-body font-medium text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
            >
              +
            </button>
            {showVolumeUnit ? (
              <select
                value={rule.limitUnit ?? defaultLimitUnitForRule(rule.ruleType)}
                aria-label="Volume unit"
                onChange={(event) =>
                  onLimitUnitChange(rule, event.target.value as VolumeCapUnit)
                }
                className="max-w-20 rounded-md border border-border bg-bg-sunken px-1.5 py-1 text-caption text-ink"
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
        ) : (
          <span aria-hidden="true" />
        )}

        <DeleteButton
          aria-label={`Delete ${rowLabel} rule`}
          onClick={() => onDelete(rule.id)}
          className="shrink-0 justify-self-end"
        />
      </div>
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
  onAddClassCap,
  onCancelClassCap,
  onConfirmClassCap,
  onAddExerciseRule,
  onCancelExerciseRule,
  onConfirmExerciseRule,
  activityNameById,
  ruleMutationError,
}: ClassRulesSectionProps): React.ReactElement {
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
