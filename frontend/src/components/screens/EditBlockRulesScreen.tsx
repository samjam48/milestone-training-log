import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { StackScreenEngineBody } from '../ui/StackScreenEngineBody';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import type { Rule, RuleType } from '../../types';

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

interface RuleGroup {
  id: string;
  label: string;
  rules: Rule[];
}

const RULE_TYPE_OPTIONS: { value: RuleType; label: string }[] = [
  { value: 'rest_between_class', label: 'Rest between class' },
  { value: 'frequency_limit', label: 'Frequency limit' },
  { value: 'weekly_load_cap', label: 'Weekly load cap' },
  { value: 'consecutive_day_limit', label: 'Consecutive day limit' },
  { value: 'weekly_activity_count', label: 'Weekly activity count' },
];

const RULE_DEFINITIONS: Record<RuleType, RuleDefinition> = {
  rest_between_class: {
    label: 'Min rest between sessions',
    unit: 'days',
    min: 1,
    step: 1,
  },
  frequency_limit: {
    label: 'Max sessions per week',
    unit: '×/wk',
    min: 1,
    step: 1,
  },
  weekly_load_cap: {
    label: 'Weekly load cap',
    unit: 'load',
    min: 10,
    step: 1,
  },
  consecutive_day_limit: {
    label: 'Max consecutive days',
    unit: 'days',
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

function buildRuleGroups(engine: MilestoneEngineResult): RuleGroup[] {
  const rulesByClassId = new Map<string | null, Rule[]>();

  for (const rule of engine.rules) {
    const classRules = rulesByClassId.get(rule.activityClassId) ?? [];
    classRules.push(rule);
    rulesByClassId.set(rule.activityClassId, classRules);
  }

  const groups: RuleGroup[] = [];

  const allClassRules = rulesByClassId.get(null);
  if (allClassRules != null && allClassRules.length > 0) {
    groups.push({
      id: 'all-classes',
      label: 'All Classes',
      rules: allClassRules,
    });
  }

  for (const activityClass of engine.activityClasses) {
    const classRules = rulesByClassId.get(activityClass.id);
    if (classRules != null && classRules.length > 0) {
      groups.push({
        id: activityClass.id,
        label: activityClass.name,
        rules: classRules,
      });
    }
  }

  const knownClassIds = new Set(engine.activityClasses.map((activityClass) => activityClass.id));
  for (const [activityClassId, classRules] of rulesByClassId) {
    if (
      activityClassId != null &&
      !knownClassIds.has(activityClassId) &&
      classRules.length > 0
    ) {
      groups.push({
        id: activityClassId,
        label: 'Unknown class',
        rules: classRules,
      });
    }
  }

  return groups;
}

function clampThreshold(value: number, definition: RuleDefinition): number {
  return Math.max(definition.min, value);
}

function formatThreshold(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function parseDisplayedThreshold(
  displayedValue: string,
  fallbackValue: number,
): number {
  const parsedValue = Number(displayedValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

const DEFAULT_NEW_RULE_DRAFT: Pick<RuleDraft, 'ruleType' | 'thresholdValue'> = {
  ruleType: 'rest_between_class',
  thresholdValue: 1,
};

export function EditBlockRulesScreen({
  engine,
  onBack,
}: EditBlockRulesScreenProps): React.ReactElement {
  const [draftThresholds, setDraftThresholds] = React.useState<Record<string, string>>({});
  const [isAddingRule, setIsAddingRule] = React.useState(false);
  const [newRuleType, setNewRuleType] = React.useState<RuleType>(DEFAULT_NEW_RULE_DRAFT.ruleType);
  const [newRuleThreshold, setNewRuleThreshold] = React.useState(
    String(DEFAULT_NEW_RULE_DRAFT.thresholdValue),
  );
  const ruleGroups = buildRuleGroups(engine);

  React.useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const rule of engine.rules) {
      nextDrafts[rule.id] = formatThreshold(rule.thresholdValue);
    }
    setDraftThresholds(nextDrafts);
  }, [engine.rules]);

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

  function openAddRuleForm(): void {
    setNewRuleType(DEFAULT_NEW_RULE_DRAFT.ruleType);
    setNewRuleThreshold(String(DEFAULT_NEW_RULE_DRAFT.thresholdValue));
    setIsAddingRule(true);
  }

  function cancelAddRuleForm(): void {
    setIsAddingRule(false);
  }

  function confirmAddRule(): void {
    const parsedThreshold = Number(newRuleThreshold);
    if (!Number.isFinite(parsedThreshold)) {
      return;
    }
    const definition = RULE_DEFINITIONS[newRuleType];
    const thresholdValue = clampThreshold(parsedThreshold, definition);
    engine.createRule({
      activityClassId: null,
      ruleType: newRuleType,
      thresholdValue,
      windowDays: 7,
      enabled: true,
    });
    setIsAddingRule(false);
  }

  function handleDeleteRule(ruleId: string): void {
    engine.deleteRule(ruleId);
  }

  return (
    <section className="flex min-h-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-title font-bold text-ink">Edit Rules</h1>
          <p className="truncate text-body-sm text-ink-muted">{engine.block.name}</p>
        </div>
      </header>

      <StackScreenEngineBody engine={engine}>
      <div className="flex flex-1 flex-col gap-5 px-4 py-5 pb-12">
        {engine.rules.length === 0 && !isAddingRule ? (
          <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
            <p className="text-body-md text-ink-muted">
              No rules configured for this block.
            </p>
          </div>
        ) : (
          ruleGroups.map((group) => (
            <section key={group.id} className="flex flex-col gap-2">
              <h2 className="text-title-sm font-semibold text-ink">{group.label}</h2>
              <Card pad="none">
                <div className="divide-y divide-border-subtle">
                {group.rules.map((rule) => {
                  const definition = RULE_DEFINITIONS[rule.ruleType];
                  const inputId = `rule-threshold-${rule.id}`;
                  const thresholdValue = draftThresholds[rule.id] ?? formatThreshold(rule.thresholdValue);

                  return (
                    <div key={rule.id} className="px-4 py-3.5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={inputId}
                            className="text-body font-medium text-ink"
                          >
                            {definition.label}
                          </label>
                          {group.rules.length > 1 ? (
                            <p className="mt-0.5 text-caption text-ink-muted">
                              {group.label}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-caption font-medium text-danger-fg hover:underline"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={rule.enabled}
                            aria-label={`${definition.label} enabled`}
                            onClick={() => engine.updateRule(rule.id, { enabled: !rule.enabled })}
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
                              commitThreshold(
                                rule,
                                parseDisplayedThreshold(thresholdValue, rule.thresholdValue) -
                                  definition.step,
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-sunken text-body-lg font-medium text-ink-muted transition-colors hover:bg-bg-overlay hover:text-ink"
                          >
                            -
                          </button>
                          <div className="flex flex-1 items-center justify-center gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                id={inputId}
                                type="number"
                                min={definition.min}
                                step={definition.step}
                                value={thresholdValue}
                                onChange={(event) =>
                                  updateDraftThreshold(rule.id, event.target.value)
                                }
                                onBlur={() => commitDraftThreshold(rule)}
                                className="w-16 rounded-md border border-border bg-bg-sunken px-2 py-1.5 text-center text-body-lg font-semibold tabular-nums text-ink outline-none"
                              />
                              <span className="shrink-0 text-caption text-ink-faint">
                                {definition.unit}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={`Increase ${definition.label}`}
                            onClick={() =>
                              commitThreshold(
                                rule,
                                parseDisplayedThreshold(thresholdValue, rule.thresholdValue) +
                                  definition.step,
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
                })}
                </div>
              </Card>
            </section>
          ))
        )}

        {isAddingRule ? (
          <Card pad="md">
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="new-rule-type"
                  className="mb-1 block text-body font-medium text-ink"
                >
                  Rule type
                </label>
                <select
                  id="new-rule-type"
                  value={newRuleType}
                  onChange={(event) => setNewRuleType(event.target.value as RuleType)}
                  aria-label="Rule type"
                  className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
                >
                  {RULE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="new-rule-threshold"
                  className="mb-1 block text-caption text-ink-muted"
                >
                  {RULE_DEFINITIONS[newRuleType].label}
                </label>
                <input
                  id="new-rule-threshold"
                  type="number"
                  min={RULE_DEFINITIONS[newRuleType].min}
                  step={RULE_DEFINITIONS[newRuleType].step}
                  value={newRuleThreshold}
                  onChange={(event) => setNewRuleThreshold(event.target.value)}
                  className="w-full rounded-md border border-border bg-bg-sunken px-3 py-2 text-body text-ink"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelAddRuleForm}
                  className="flex-1 h-11 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAddRule}
                  className="flex-1 h-11 rounded-md bg-ink text-body-lg font-semibold text-ink-inverse transition-colors duration-snap active:opacity-80"
                >
                  Save
                </button>
              </div>
            </div>
          </Card>
        ) : null}

        {!isAddingRule ? (
          <button
            type="button"
            onClick={openAddRuleForm}
            className="w-full rounded-md border border-dashed border-border py-2.5 text-body text-ink-muted transition-colors hover:bg-bg-overlay"
          >
            Add rule
          </button>
        ) : null}
      </div>
      </StackScreenEngineBody>
    </section>
  );
}
