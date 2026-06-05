// =============================================================================
// SettingsScreen — Training block & app settings screen
// -----------------------------------------------------------------------------
// F2.3: Ports the SettingsScreen.jsx prototype to strict TypeScript.
// Props: { engine: MilestoneEngineResult }
// =============================================================================

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { ReviewMilestoneBadge } from '../ui/ReviewMilestoneBadge';
import { apiFetch, ApiError } from '../../lib/api/client';
import type {
  MilestoneEngineResult,
  NewActivityClassDraft,
  NewActivityDraft,
} from '../../hooks/useMilestoneEngine';
import type {
  Activity,
  ActivityClass,
  ActivityLog,
  ActivityType,
  ID,
  Rule,
  RuleType,
  WeeklyTarget,
  TrainingBlock,
} from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SettingsScreenProps {
  engine: MilestoneEngineResult;
  onEditRules?: () => void;
  onReview?: () => void;
  onNewBlock?: () => void;
  onViewBlock?: (blockId: ID) => void;
  onEditActivity?: (activity: Activity) => void;
  onUnauthenticated?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
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
  onReview?: () => void;
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
          {block.isReviewMilestoneHit ? (
            <ReviewMilestoneBadge className="mt-2" />
          ) : null}
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
      {showEditRules && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEditRules}
            className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
          >
            Edit rules
          </button>
          {onReview != null && (
            <button
              type="button"
              onClick={onReview}
              className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
            >
              Review
            </button>
          )}
        </div>
      )}
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
  onEdit?: () => void;
  onDeactivate?: () => void;
  deactivateConfirming?: boolean;
  onConfirmDeactivate?: () => void;
  onCancelDeactivate?: () => void;
  onRestore?: () => void;
}

function ActivityManagerRow({
  activity,
  lastLogDate,
  onEdit,
  onDeactivate,
  deactivateConfirming = false,
  onConfirmDeactivate,
  onCancelDeactivate,
  onRestore,
}: ActivityManagerRowProps): React.ReactElement {
  const isPerf = activity.type === 'performance';
  const typeCls = isPerf
    ? 'text-caution-fg bg-caution/10'
    : 'text-safe-fg bg-safe/10';
  const typeLabel = isPerf ? 'perf' : 'recovery';
  const lastFmt = lastLogDate ? formatShortDate(lastLogDate) : 'Never';

  return (
    <div className="py-3 px-4">
      <div className="flex items-center gap-3">
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
        {onRestore != null && (
          <button
            type="button"
            aria-label={`Restore ${activity.name}`}
            onClick={onRestore}
            className="h-8 px-2.5 rounded-md text-caption font-medium text-safe-fg bg-safe/10 hover:bg-safe/20 transition-colors duration-snap shrink-0"
          >
            Restore
          </button>
        )}
        {onRestore == null && onEdit != null && onDeactivate != null && (
          <div className="flex items-center gap-1 shrink-0">
            {deactivateConfirming && onConfirmDeactivate != null && onCancelDeactivate != null ? (
              <>
                <button
                  type="button"
                  aria-label={`Cancel deactivating ${activity.name}`}
                  onClick={onCancelDeactivate}
                  className="h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  aria-label={`Confirm deactivate ${activity.name}`}
                  onClick={onConfirmDeactivate}
                  className="h-8 px-2.5 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
                >
                  Confirm
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
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
// NewActivityClassForm — create activity class dialog
// ---------------------------------------------------------------------------

interface NewActivityClassFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: NewActivityClassDraft) => Promise<void>;
}

function NewActivityClassForm({
  open,
  onClose,
  onSubmit,
}: NewActivityClassFormProps): React.ReactElement | null {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<ActivityType>('performance');
  const [description, setDescription] = React.useState('');
  const [recoveryWindowDays, setRecoveryWindowDays] = React.useState(3);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setType('performance');
      setDescription('');
      setRecoveryWindowDays(3);
      setApiError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canCreate) return;

    setApiError(null);
    setSubmitting(true);

    const draft: NewActivityClassDraft = {
      name: trimmedName,
      type,
      defaultRecoveryWindowDays: recoveryWindowDays,
    };
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 0) {
      draft.description = trimmedDescription;
    }

    try {
      await onSubmit(draft);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('Could not create activity class.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border pb-safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-label="New activity class"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <form className="px-4 pb-8 pt-2" onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-title font-bold text-ink">New Activity Class</h2>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-ink-muted">Class name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-md border border-border bg-bg px-3 text-body text-ink"
                autoComplete="off"
              />
            </label>

            <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
              <legend className="text-label font-medium text-ink-muted mb-1">Type</legend>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="radio"
                  name="activityClassType"
                  value="performance"
                  checked={type === 'performance'}
                  onChange={() => setType('performance')}
                />
                Performance
              </label>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="radio"
                  name="activityClassType"
                  value="recovery"
                  checked={type === 'recovery'}
                  onChange={() => setType('recovery')}
                  aria-label="Recovery"
                />
                <span aria-hidden="true">Recovery</span>
              </label>
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-ink-muted">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-md border border-border bg-bg px-3 py-2 text-body text-ink resize-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-medium text-ink-muted">Recovery window (days)</span>
              <input
                type="number"
                min={1}
                value={recoveryWindowDays}
                onChange={(e) => setRecoveryWindowDays(Number(e.target.value))}
                className="h-11 rounded-md border border-border bg-bg px-3 text-body text-ink tabular-nums"
              />
            </label>

            {apiError != null && (
              <p className="text-body text-danger-fg" role="alert">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canCreate}
              className={cn(
                'w-full h-11 rounded-md text-body font-medium transition-colors duration-snap',
                canCreate
                  ? 'bg-ink text-ink-inverse hover:opacity-90'
                  : 'bg-bg-sunken text-ink-faint cursor-not-allowed',
              )}
            >
              Create class
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export function SettingsScreen({
  engine,
  onEditRules,
  onReview,
  onNewBlock,
  onViewBlock,
  onEditActivity,
  onUnauthenticated,
}: SettingsScreenProps): React.ReactElement {
  const {
    block,
    rules,
    weeklyTargets,
    activityClasses,
    activities,
    logs,
    previousBlocks,
    deactivateActivity,
    updateActivity,
    submitNewActivityClass,
  } = engine;

  const queryClient = useQueryClient();
  const [notifications, setNotifications] = React.useState(true);
  const [metricUnits, setMetricUnits] = React.useState(true);
  const [resetState, setResetState] = React.useState<'idle' | 'confirming' | 'done'>('idle');
  const [pendingDeactivateId, setPendingDeactivateId] = React.useState<string | null>(null);
  const [showNewClassForm, setShowNewClassForm] = React.useState(false);

  function handleResetMockData(): void {
    if (resetState === 'idle') {
      setResetState('confirming');
      return;
    }
    if (resetState === 'confirming') {
      void apiFetch('/dev/reset', { method: 'POST' })
        .then(() => {
          void queryClient.invalidateQueries();
          setResetState('done');
          setTimeout(() => setResetState('idle'), 2000);
        })
        .catch(() => { setResetState('idle'); });
    }
  }

  function handleLogout(): void {
    void apiFetch('/auth/logout', { method: 'POST' })
      .then(() => {
        onUnauthenticated?.();
      })
      .catch(() => {
        onUnauthenticated?.();
      });
  }

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

  const groupedInactive = React.useMemo(
    () =>
      activityClasses
        .map((cls) => ({
          cls,
          acts: activities.filter(
            (a) => a.activityClassId === cls.id && !a.isActive,
          ),
        }))
        .filter((g) => g.acts.length > 0),
    [activityClasses, activities],
  );

  const [inactiveSectionPinned, setInactiveSectionPinned] = React.useState(false);
  React.useEffect(() => {
    if (groupedInactive.length > 0) {
      setInactiveSectionPinned(true);
    }
  }, [groupedInactive.length]);

  const showInactiveSection = inactiveSectionPinned || groupedInactive.length > 0;

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
              onEditRules={() => onEditRules?.()}
              onReview={onReview}
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
                    {pb.isReviewMilestoneHit ? <ReviewMilestoneBadge compact /> : null}
                    <button
                      type="button"
                      onClick={() => onViewBlock?.(pb.id)}
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
          onClick={() => onNewBlock?.()}
          className="w-full h-11 rounded-md bg-bg-raised border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          + New Training Block
        </button>

        {/* ── Activity classes ── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-label uppercase font-medium text-ink-muted">
              Activity classes
            </p>
            <button
              type="button"
              onClick={() => setShowNewClassForm(true)}
              className="shrink-0 h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
            >
              + New class
            </button>
          </div>
          {activityClasses.length > 0 && (
            <Card pad="none">
              <ul className="divide-y divide-border-subtle">
                {activityClasses.map((cls) => (
                  <li
                    key={cls.id}
                    className="px-4 py-3 text-body font-medium text-ink"
                  >
                    {cls.name}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

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
                        onEdit={() => onEditActivity?.(act)}
                        onDeactivate={() => setPendingDeactivateId(act.id)}
                        deactivateConfirming={pendingDeactivateId === act.id}
                        onCancelDeactivate={() => setPendingDeactivateId(null)}
                        onConfirmDeactivate={() => {
                          deactivateActivity(act.id);
                          setPendingDeactivateId(null);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* ── Inactive Activities ── */}
        {showInactiveSection && (
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Inactive Activities
          </p>
          {groupedInactive.length > 0 && (
            <Card pad="none">
              <div className="divide-y divide-border-subtle">
                {groupedInactive.map(({ cls, acts }) => (
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
                        onRestore={() =>
                          updateActivity(
                            act.id,
                            { isActive: true } as Partial<NewActivityDraft>,
                          )
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
        )}

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
              {import.meta.env.VITE_DEV_MODE === 'true' && (
                <div>
                  {resetState === 'done' ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-safe-fg text-body font-medium">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Data reset
                    </div>
                  ) : resetState === 'confirming' ? (
                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                      <span className="text-body text-ink-muted">Reset all data to seed state?</span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setResetState('idle')}
                          className="h-7 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleResetMockData}
                          className="h-7 px-3 rounded-md text-caption font-medium text-white bg-danger hover:opacity-90 transition-opacity"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetMockData}
                      className="w-full flex items-center justify-between px-4 py-3 text-danger-fg hover:bg-danger/5 transition-colors duration-snap text-left"
                    >
                      <span className="text-body font-medium">Reset mock data</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        <path d="M8 1v4l3-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
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

      <footer className="px-4 pb-8 pt-2 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-md border border-border px-4 py-2.5 text-body font-medium text-ink-muted hover:bg-bg-sunken transition-colors"
        >
          Log out
        </button>
      </footer>

      <NewActivityClassForm
        open={showNewClassForm}
        onClose={() => setShowNewClassForm(false)}
        onSubmit={submitNewActivityClass}
      />
    </div>
  );
}
