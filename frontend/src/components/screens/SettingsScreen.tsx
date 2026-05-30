// =============================================================================
// SettingsScreen — Training block & app settings screen
// -----------------------------------------------------------------------------
// F2.3: Ports the SettingsScreen.jsx prototype to strict TypeScript.
// Props: { engine: MilestoneEngineResult }
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import type { MilestoneEngineResult, RuleDraft, RulePatch, BlockDraft } from '../../hooks/useMilestoneEngine';
import type { ActivityClass, ActivityLog, Rule, RuleType, WeeklyTarget, TrainingBlock } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SettingsScreenProps {
  engine: MilestoneEngineResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Rule label map
// ---------------------------------------------------------------------------

type RuleLabelFn = (v: number) => string;

const RULE_LABEL: Partial<Record<RuleType, RuleLabelFn>> = {
  rest_between_class:    (v) => `Min ${v}-day rest`,
  frequency_limit:       (v) => `Max ${v}× / week`,
  weekly_load_cap:       (v) => `Load cap ${v} / week`,
  consecutive_day_limit: (v) => `Max ${v} consecutive days`,
  weekly_activity_count: (v) => `Max ${v} sessions / week`,
};

// ---------------------------------------------------------------------------
// BlockSummaryCard
// ---------------------------------------------------------------------------

interface BlockSummaryCardProps {
  block: TrainingBlock;
  rules: Rule[];
  weeklyTargets: WeeklyTarget[];
  activityClasses: ActivityClass[];
  /** Whether the Edit rules CTA should be rendered. */
  showEditRules: boolean;
  onEditRules: () => void;
  onReview: () => void;
}

function BlockSummaryCard({
  block,
  rules,
  weeklyTargets,
  activityClasses,
  showEditRules,
  onEditRules,
  onReview,
}: BlockSummaryCardProps): React.ReactElement {
  const classMap = new Map(activityClasses.map((c) => [c.id, c]));
  const activeRules = rules.filter((r) => r.enabled);

  return (
    <Card pad="md">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <CardTitle>{block.name}</CardTitle>
          <CardMeta>
            Started {formatShortDate(block.startDate)}
            {block.endDate ? ` · Ends ${formatShortDate(block.endDate)}` : ''}
          </CardMeta>
        </div>
        <span className="inline-flex items-center gap-1.5 text-caption font-medium text-safe-fg">
          <span
            className="h-2 w-2 rounded-full bg-safe-fg"
            aria-hidden="true"
          />
          Active
        </span>
      </CardHeader>

      {/* Weekly targets */}
      {weeklyTargets.length > 0 && (
        <div className="mb-4">
          <p className="text-label uppercase font-medium text-ink-faint mb-2">Weekly Targets</p>
          <ul className="flex flex-col gap-1.5">
            {weeklyTargets.map((wt) => {
              const cls = classMap.get(wt.activityClassId);
              return (
                <li
                  key={wt.id}
                  className="flex items-center justify-between gap-3 text-body"
                >
                  <span className="text-ink-muted truncate">
                    {cls ? cls.name : wt.activityClassId}
                  </span>
                  <span className="font-medium tabular-nums text-ink shrink-0">
                    {wt.targetValue} {wt.targetUnit}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Recovery rules */}
      {activeRules.length > 0 && (
        <div className="mb-4 pt-3 border-t border-border-subtle">
          <p className="text-label uppercase font-medium text-ink-faint mb-2">Recovery Rules</p>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {activeRules.map((rule) => {
              const cls = rule.activityClassId ? classMap.get(rule.activityClassId) : null;
              const labelFn = RULE_LABEL[rule.ruleType];
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-3 py-2 text-body"
                >
                  <span className="text-ink-muted truncate">
                    {cls ? cls.name : 'All classes'}
                  </span>
                  <span className="text-ink shrink-0">
                    {labelFn ? labelFn(rule.thresholdValue) : rule.ruleType}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-2">
        {showEditRules && (
          <button
            type="button"
            onClick={onEditRules}
            className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
          >
            Edit rules
          </button>
        )}
        <button
          type="button"
          onClick={onReview}
          className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          Block summary
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ActivityManagerRow
// ---------------------------------------------------------------------------

interface ActivityManagerRowProps {
  activity: {
    id: string;
    name: string;
    type: string;
    defaultVolumeUnit?: string;
  };
  lastLogDate: string | null;
  onEdit: () => void;
  onDeactivate: () => void;
}

function ActivityManagerRow({
  activity,
  lastLogDate,
  onEdit,
  onDeactivate,
}: ActivityManagerRowProps): React.ReactElement {
  const isPerf = activity.type === 'performance';
  const typeCls = isPerf
    ? 'text-caution-fg bg-caution/10'
    : 'text-safe-fg bg-safe/10';
  const typeLabel = isPerf ? 'perf' : 'recovery';
  const lastFmt = lastLogDate ? formatShortDate(lastLogDate) : 'Never';

  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-ink">{activity.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              'text-caption font-medium rounded-full px-1.5 py-0.5',
              typeCls,
            )}
          >
            {typeLabel}
          </span>
          {activity.defaultVolumeUnit != null && (
            <span className="text-caption text-ink-faint">
              {activity.defaultVolumeUnit}
            </span>
          )}
          <span className="text-caption text-ink-faint">· Last: {lastFmt}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label={`Edit ${activity.name}`}
          onClick={onEdit}
          className="h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Deactivate ${activity.name}`}
          onClick={onDeactivate}
          className="h-8 px-2.5 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
        >
          Deactivate
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreferenceRow — toggle switch row
// ---------------------------------------------------------------------------

interface PreferenceRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function PreferenceRow({
  label,
  description,
  value,
  onChange,
}: PreferenceRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 py-3 px-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-ink">{label}</p>
        {description != null && (
          <p className="text-caption text-ink-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-snap',
          value ? 'bg-safe' : 'bg-bg-sunken border border-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full shadow transition-transform duration-snap',
            value ? 'bg-ink-inverse translate-x-5' : 'bg-ink-faint translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditRulesForm — dialog for editing rules
// ---------------------------------------------------------------------------

interface EditRuleState {
  id: string;
  activityClassId: string | null;
  ruleType: RuleType;
  thresholdValue: number;
  windowDays: number;
  enabled: boolean;
  isNew: boolean;
  isDeleted: boolean;
}

interface EditRulesFormProps {
  open: boolean;
  onClose: () => void;
  block: TrainingBlock;
  rules: Rule[];
  onCreateRule: (draft: RuleDraft) => void;
  onUpdateRule: (ruleId: string, patch: RulePatch) => void;
  onDeleteRule: (ruleId: string) => void;
}

const RULE_TYPE_OPTIONS: { value: RuleType; label: string }[] = [
  { value: 'rest_between_class', label: 'Rest between class' },
  { value: 'frequency_limit', label: 'Frequency limit' },
  { value: 'weekly_load_cap', label: 'Weekly load cap' },
  { value: 'consecutive_day_limit', label: 'Consecutive day limit' },
  { value: 'weekly_activity_count', label: 'Weekly activity count' },
];

const RULE_FIELD_LABELS: Partial<Record<RuleType, string>> = {
  rest_between_class:    'Rest between class (days)',
  frequency_limit:       'Frequency limit (per week)',
  weekly_load_cap:       'Weekly load cap',
  consecutive_day_limit: 'Consecutive day limit',
  weekly_activity_count: 'Weekly activity count (sessions)',
};

function makeRuleState(rule: Rule): EditRuleState {
  return {
    id: rule.id,
    activityClassId: rule.activityClassId,
    ruleType: rule.ruleType,
    thresholdValue: rule.thresholdValue,
    windowDays: rule.windowDays,
    enabled: rule.enabled,
    isNew: false,
    isDeleted: false,
  };
}

function EditRulesForm({
  open,
  onClose,
  block,
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
}: EditRulesFormProps): React.ReactElement | null {
  const [ruleStates, setRuleStates] = React.useState<EditRuleState[]>([]);

  // Reset form each time it opens
  React.useEffect(() => {
    if (open) {
      setRuleStates(rules.map(makeRuleState));
    }
  }, [open, rules]);

  if (!open) return null;

  function handleThresholdChange(idx: number, value: string): void {
    const num = Number(value);
    if (isNaN(num)) return;
    setRuleStates((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, thresholdValue: num } : r)),
    );
  }

  function handleDelete(idx: number): void {
    setRuleStates((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, isDeleted: true } : r)),
    );
  }

  function handleAddRule(): void {
    const newRule: EditRuleState = {
      id: `new-${Date.now()}`,
      activityClassId: null,
      ruleType: 'rest_between_class',
      thresholdValue: 1,
      windowDays: 7,
      enabled: true,
      isNew: true,
      isDeleted: false,
    };
    setRuleStates((prev) => [...prev, newRule]);
  }

  function handleNewRuleType(idx: number, ruleType: RuleType): void {
    setRuleStates((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ruleType } : r)),
    );
  }

  function handleSave(): void {
    const originalRules = new Map(rules.map((r) => [r.id, r]));

    for (const rs of ruleStates) {
      if (rs.isNew && !rs.isDeleted) {
        onCreateRule({
          activityClassId: rs.activityClassId,
          ruleType: rs.ruleType,
          thresholdValue: rs.thresholdValue,
          windowDays: rs.windowDays,
          enabled: rs.enabled,
        });
      } else if (!rs.isNew && rs.isDeleted) {
        onDeleteRule(rs.id);
      } else if (!rs.isNew && !rs.isDeleted) {
        const original = originalRules.get(rs.id);
        if (original && original.thresholdValue !== rs.thresholdValue) {
          onUpdateRule(rs.id, { thresholdValue: rs.thresholdValue });
        }
      }
    }

    onClose();
  }

  const visibleRules = ruleStates.filter((r) => !r.isDeleted);

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border overflow-y-auto max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit rules for ${block.name}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="px-4 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-title font-bold text-ink">Edit Rules</h2>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {visibleRules.map((rs, idx) => {
              // Use the field label for the <label> element associated with the input.
              // Do NOT also set aria-label on the input since it already has a <label>.
              const fieldLabel = RULE_FIELD_LABELS[rs.ruleType] ?? rs.ruleType;
              const inputId = `rule-threshold-${rs.id}`;

              return (
                <div
                  key={rs.id}
                  className="flex flex-col gap-2 p-3 rounded-md bg-bg-sunken border border-border"
                >
                  {rs.isNew && (
                    <div>
                      <label
                        htmlFor={`rule-type-${rs.id}`}
                        className="block text-body font-medium text-ink mb-1"
                      >
                        Rule type
                      </label>
                      <select
                        id={`rule-type-${rs.id}`}
                        value={rs.ruleType}
                        onChange={(e) =>
                          handleNewRuleType(idx, e.target.value as RuleType)
                        }
                        aria-label="Rule type"
                        className="w-full rounded-md bg-bg-raised border border-border px-3 py-2 text-body text-ink"
                      >
                        {RULE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    {/* Use <label> for association — do NOT set aria-label on the input too */}
                    <label
                      htmlFor={inputId}
                      className="block text-caption text-ink-muted mb-1"
                    >
                      {fieldLabel}
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      step={1}
                      value={rs.thresholdValue}
                      onChange={(e) => handleThresholdChange(idx, e.target.value)}
                      className="w-full rounded-md bg-bg-raised border border-border px-3 py-2 text-body text-ink"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="text-caption text-danger-fg hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddRule}
              className="w-full h-9 rounded-md border border-dashed border-border text-body text-ink-muted hover:bg-bg-overlay transition-colors"
            >
              Add rule
            </button>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap active:bg-bg-overlay"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 h-11 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// NewTrainingBlockSheet
// ---------------------------------------------------------------------------

interface NewTrainingBlockSheetProps {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: BlockDraft) => void;
}

function NewTrainingBlockSheet({
  open,
  onClose,
  onCreate,
}: NewTrainingBlockSheetProps): React.ReactElement | null {
  const [name, setName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setName('');
      setStartDate('');
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && startDate.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!canSubmit) return;

    onCreate({
      name: name.trim(),
      startDate: startDate as import('../../types').ISODate,
    });
    onClose();
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border"
        role="dialog"
        aria-modal="true"
        aria-label="New Training Block"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="px-4 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-title font-bold text-ink">New Training Block</h2>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
              aria-label="Close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* ── Name ── */}
            <div>
              <label
                htmlFor="new-block-name"
                className="block text-body font-medium text-ink mb-2"
              >
                Name
              </label>
              <input
                id="new-block-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. June Rehab Block"
                autoFocus
                aria-label="Name"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink placeholder:text-ink-faint',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Start date ── */}
            <div>
              <label
                htmlFor="new-block-start-date"
                className="block text-body font-medium text-ink mb-2"
              >
                Start date
              </label>
              <input
                id="new-block-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap active:bg-bg-overlay"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'flex-1 h-11 rounded-md text-body-lg font-semibold transition-colors duration-snap',
                  canSubmit
                    ? 'bg-ink text-ink-inverse active:opacity-80'
                    : 'bg-ink/20 text-ink-faint cursor-not-allowed',
                )}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export function SettingsScreen({ engine }: SettingsScreenProps): React.ReactElement {
  const {
    block,
    rules,
    weeklyTargets,
    activityClasses,
    activities,
    logs,
    previousBlocks,
    createRule,
    updateRule,
    deleteRule,
    createTrainingBlock,
  } = engine;

  const [editRulesOpen, setEditRulesOpen] = React.useState(false);
  const [newBlockOpen, setNewBlockOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);
  const [metricUnits, setMetricUnits] = React.useState(true);

  const hasBlock = block.id !== '';

  // O(n) last-log-date per activity
  const lastByAct = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (logs as ActivityLog[]).forEach((l) => {
      const existing = map[l.activityId];
      if (existing == null || l.loggedDate > existing) {
        map[l.activityId] = l.loggedDate;
      }
    });
    return map;
  }, [logs]);

  // Group active activities by class
  const grouped = React.useMemo(
    () =>
      activityClasses
        .map((cls) => ({
          cls,
          acts: activities.filter(
            (a) => a.activityClassId === cls.id && a.isActive,
          ),
        }))
        .filter((g) => g.acts.length > 0),
    [activityClasses, activities],
  );

  const showEditRules = hasBlock;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-2 shrink-0">
        <h1 className="text-title font-bold text-ink">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10">

        {/* ── Training Block ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Training Block
          </p>
          {hasBlock ? (
            <BlockSummaryCard
              block={block}
              rules={rules}
              weeklyTargets={weeklyTargets}
              activityClasses={activityClasses}
              showEditRules={showEditRules}
              onEditRules={() => setEditRulesOpen(true)}
              onReview={() => undefined}
            />
          ) : (
            <Card pad="md">
              <p className="text-body text-ink-muted">No active training block</p>
            </Card>
          )}
        </section>

        {/* ── Previous Blocks ── */}
        {previousBlocks.length > 0 && (
          <section>
            <p className="text-label uppercase font-medium text-ink-muted mb-3">
              Previous Blocks
            </p>
            <Card pad="none">
              <div className="divide-y divide-border-subtle">
                {previousBlocks.map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-ink">{pb.name}</p>
                      <p className="text-caption text-ink-muted">
                        {formatShortDate(pb.startDate)}
                        {' – '}
                        {pb.endDate ? formatShortDate(pb.endDate) : 'ongoing'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* ── + New Training Block ── */}
        <button
          type="button"
          onClick={() => setNewBlockOpen(true)}
          className="w-full h-11 rounded-md bg-bg-raised border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          + New Training Block
        </button>

        {/* ── Activities ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Activities
          </p>
          {grouped.length > 0 && (
            <Card pad="none">
              <div className="divide-y divide-border-subtle">
                {grouped.map(({ cls, acts }) => (
                  <div key={cls.id}>
                    <div className="px-4 pt-3 pb-1.5">
                      <p className="text-caption font-semibold text-ink-muted uppercase tracking-wide">
                        {cls.name}
                      </p>
                    </div>
                    {acts.map((act) => (
                      <ActivityManagerRow
                        key={act.id}
                        activity={act}
                        lastLogDate={lastByAct[act.id] ?? null}
                        onEdit={() => undefined}
                        onDeactivate={() => undefined}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* ── Preferences ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Preferences
          </p>
          <Card pad="none">
            <div className="divide-y divide-border-subtle">
              <PreferenceRow
                label="Notifications"
                description="Daily check-in reminders"
                value={notifications}
                onChange={setNotifications}
              />
              <PreferenceRow
                label="Metric units"
                description="Metric system — toggle for imperial"
                value={metricUnits}
                onChange={setMetricUnits}
              />
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-danger-fg hover:bg-danger/5 transition-colors duration-snap text-left"
                >
                  <span className="text-body font-medium">Reset mock data</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13 8A5 5 0 1 1 8 3"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 1v4l3-2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Card>
        </section>

        {/* ── About ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            About
          </p>
          <Card pad="none">
            <div className="divide-y divide-border-subtle">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-body text-ink">Version</span>
                <span className="text-body text-ink-muted tabular-nums">
                  0.1.0-preview
                </span>
              </div>
            </div>
          </Card>
        </section>

      </div>

      {/* ── Edit Rules dialog ── */}
      {hasBlock && (
        <EditRulesForm
          open={editRulesOpen}
          onClose={() => setEditRulesOpen(false)}
          block={block}
          rules={rules}
          onCreateRule={createRule}
          onUpdateRule={updateRule}
          onDeleteRule={deleteRule}
        />
      )}

      {/* ── New Training Block sheet ── */}
      <NewTrainingBlockSheet
        open={newBlockOpen}
        onClose={() => setNewBlockOpen(false)}
        onCreate={createTrainingBlock}
      />
    </div>
  );
}
