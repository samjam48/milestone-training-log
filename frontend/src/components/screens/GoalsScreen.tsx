// =============================================================================
// GoalsScreen — Goals & Planning tab
// -----------------------------------------------------------------------------
// F2.2: Ports the GoalsScreen.jsx prototype to strict TypeScript.
// Props: { engine: MilestoneEngineResult }
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { MilestoneEngineResult, GoalDraft } from '../../hooks/useMilestoneEngine';
import type { ActivityClass, Goal, GoalTimeframe, SafetyState } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GoalsScreenProps {
  engine: MilestoneEngineResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function goalProgressState(
  value: number | undefined,
  target: number | undefined,
): SafetyState | 'neutral' {
  if (value == null || target == null || target <= 0) return 'neutral';
  const r = value / target;
  if (r >= 1) return 'safe';
  if (r >= 0.4) return 'caution';
  return 'neutral';
}

function formatDueDate(targetDate: string): string {
  const d = new Date(targetDate + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// GoalCard
// ---------------------------------------------------------------------------

interface GoalCardProps {
  goal: Omit<Goal, 'userId'>;
  activityClassName: string | null;
  onEdit?: () => void;
  onArchive?: (id: string) => void;
}

function GoalCard({ goal, activityClassName, onEdit, onArchive }: GoalCardProps): React.ReactElement {
  const hasProgress =
    goal.progressValue != null &&
    goal.progressTarget != null &&
    goal.progressTarget > 0;

  const state = goalProgressState(goal.progressValue, goal.progressTarget);

  const dueFmt = goal.targetDate ? formatDueDate(goal.targetDate) : null;

  let valueText: string | null = null;
  if (hasProgress && goal.progressValue != null && goal.progressTarget != null) {
    const unit = goal.progressUnit ?? '';
    valueText = unit
      ? `${goal.progressValue} / ${goal.progressTarget} ${unit}`
      : `${goal.progressValue} / ${goal.progressTarget}`;
  }

  return (
    <Card pad="md">
      {/* Title + class chip */}
      <div className="mb-3">
        <p className="text-body-lg font-semibold text-ink leading-snug">{goal.title}</p>
        {activityClassName != null && (
          <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium bg-bg-sunken text-ink-muted mt-1.5">
            {activityClassName}
          </span>
        )}
      </div>

      {/* Progress bar or qualitative placeholder */}
      {hasProgress && goal.progressValue != null && goal.progressTarget != null ? (
        <div className="mb-3">
          <ProgressBar
            value={goal.progressValue}
            target={goal.progressTarget}
            state={state}
            valueText={valueText ?? undefined}
          />
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-pill bg-bg-sunken" aria-hidden="true" />
          <span className="text-caption text-ink-faint shrink-0">Qualitative</span>
        </div>
      )}

      {/* Footer: due date + actions */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-ink-muted">
          {dueFmt != null ? `Due ${dueFmt}` : ''}
        </span>
        <div className="flex gap-1.5 shrink-0">
          {onEdit != null && (
            <button
              type="button"
              onClick={onEdit}
              className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
            >
              Edit
            </button>
          )}
          {onArchive != null && (
            <button
              type="button"
              onClick={() => onArchive(goal.id)}
              className="h-8 px-3 rounded-md text-caption font-medium text-ink-faint hover:text-ink-muted transition-colors duration-snap"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NewGoalForm — bottom-sheet dialog
// ---------------------------------------------------------------------------

interface NewGoalFormProps {
  open: boolean;
  onClose: () => void;
  activityClasses: ActivityClass[];
  onCreate: (draft: GoalDraft) => void;
}

function NewGoalForm({ open, onClose, activityClasses, onCreate }: NewGoalFormProps): React.ReactElement | null {
  const [title, setTitle] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [timeframe, setTimeframe] = React.useState<GoalTimeframe>('monthly');
  const [activityClassId, setActivityClassId] = React.useState<string>('');
  const [progressTarget, setProgressTarget] = React.useState('');
  const [progressUnit, setProgressUnit] = React.useState('');

  // Reset form each time the dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle('');
      setTargetDate('');
      setTimeframe('monthly');
      setActivityClassId('');
      setProgressTarget('');
      setProgressUnit('');
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = title.trim().length > 0 && targetDate.length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!canSubmit) return;

    const draft: GoalDraft = {
      title: title.trim(),
      targetDate,
      timeframe,
      status: 'active',
      activityClassId: activityClassId !== '' ? activityClassId : undefined,
      progressTarget: progressTarget !== '' ? Number(progressTarget) : undefined,
      progressUnit: progressUnit !== '' ? progressUnit as import('../../types').VolumeUnit : undefined,
    };
    onCreate(draft);
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
        aria-label="Create new goal"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="px-4 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-title font-bold text-ink">New Goal</h2>
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* ── Title ── */}
            <div>
              <label
                htmlFor="goal-title"
                className="block text-body font-medium text-ink mb-2"
              >
                Title
              </label>
              <input
                id="goal-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Run 50km this month"
                autoFocus
                aria-label="Title"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink placeholder:text-ink-faint',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Target date ── */}
            <div>
              <label
                htmlFor="goal-target-date"
                className="block text-body font-medium text-ink mb-2"
              >
                Target date
              </label>
              <input
                id="goal-target-date"
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                aria-label="Target date"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Timeframe ── */}
            <fieldset>
              <legend className="block text-body font-medium text-ink mb-2">
                Timeframe
              </legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="goal-timeframe"
                    value="monthly"
                    checked={timeframe === 'monthly'}
                    onChange={() => setTimeframe('monthly')}
                    aria-label="Monthly"
                  />
                  <span className="text-body text-ink">Monthly</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="goal-timeframe"
                    value="quarterly"
                    checked={timeframe === 'quarterly'}
                    onChange={() => setTimeframe('quarterly')}
                    aria-label="Quarterly"
                  />
                  <span className="text-body text-ink">Quarterly</span>
                </label>
              </div>
            </fieldset>

            {/* ── Activity class (optional) ── */}
            <div>
              <label
                htmlFor="goal-activity-class"
                className="block text-body font-medium text-ink mb-2"
              >
                Activity class (optional)
              </label>
              <select
                id="goal-activity-class"
                value={activityClassId}
                onChange={(e) => setActivityClassId(e.target.value)}
                aria-label="Activity class"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink',
                  'focus:outline-none focus:border-border-strong',
                )}
              >
                <option value="">None</option>
                {activityClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Progress target (optional) ── */}
            <div>
              <label
                htmlFor="goal-progress-target"
                className="block text-body font-medium text-ink mb-2"
              >
                Progress target (optional)
              </label>
              <input
                id="goal-progress-target"
                type="number"
                min={0}
                value={progressTarget}
                onChange={(e) => setProgressTarget(e.target.value)}
                placeholder="e.g. 50"
                aria-label="Progress target"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink placeholder:text-ink-faint',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Progress unit (optional) ── */}
            <div>
              <label
                htmlFor="goal-progress-unit"
                className="block text-body font-medium text-ink mb-2"
              >
                Unit (optional)
              </label>
              <select
                id="goal-progress-unit"
                value={progressUnit}
                onChange={(e) => setProgressUnit(e.target.value)}
                aria-label="Unit"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink',
                  'focus:outline-none focus:border-border-strong',
                )}
              >
                <option value="">No unit</option>
                <option value="km">km</option>
                <option value="mi">miles</option>
                <option value="m">m</option>
                <option value="minutes">minutes</option>
                <option value="reps">reps</option>
                <option value="sets">sets</option>
                <option value="sessions">sessions</option>
              </select>
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
                Save
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// GoalsScreen
// ---------------------------------------------------------------------------

export function GoalsScreen({ engine }: GoalsScreenProps): React.ReactElement {
  const { goals, activityClasses, archiveGoal, createGoal } = engine;

  const classMap = React.useMemo(
    () => new Map(activityClasses.map((c) => [c.id, c])),
    [activityClasses],
  );

  const monthly = React.useMemo(
    () => goals.filter((g) => g.status === 'active' && g.timeframe === 'monthly'),
    [goals],
  );
  const quarterly = React.useMemo(
    () => goals.filter((g) => g.status === 'active' && g.timeframe === 'quarterly'),
    [goals],
  );
  const achieved = React.useMemo(
    () => goals.filter((g) => g.status === 'achieved'),
    [goals],
  );
  const hasActive = monthly.length > 0 || quarterly.length > 0;

  const [showAchieved, setShowAchieved] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);

  function resolveClassName(goal: Omit<Goal, 'userId'>): string | null {
    if (goal.activityClassId == null) return null;
    return classMap.get(goal.activityClassId)?.name ?? null;
  }

  function handleCreate(draft: GoalDraft): void {
    createGoal(draft);
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <h1 className="text-title font-bold text-ink">Goals</h1>
        <p className="text-caption text-ink-muted mt-0.5">
          {monthly.length + quarterly.length} active
          {achieved.length > 0 ? ` · ${achieved.length} achieved` : ''}
        </p>
      </div>

      {/* Scrollable body — pb-24 clears the sticky CTA */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 min-h-0">
        {!hasActive ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center mt-16 px-4">
            <p className="text-title font-semibold text-ink">No goals yet</p>
            <p className="text-body text-ink-muted">
              Set a monthly or quarterly target to track your progress here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Monthly */}
            {monthly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">
                  This month
                </p>
                <div className="flex flex-col gap-3">
                  {monthly.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={resolveClassName(g)}
                      onEdit={() => undefined}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Quarterly */}
            {quarterly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">
                  This quarter
                </p>
                <div className="flex flex-col gap-3">
                  {quarterly.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={resolveClassName(g)}
                      onEdit={() => undefined}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {/* Achieved — collapsed by default, rendered outside hasActive block so it shows even with 0 active */}
        {achieved.length > 0 && (
          <section className={cn(hasActive ? 'mt-6' : 'mt-6')}>
            <button
              type="button"
              onClick={() => setShowAchieved((s) => !s)}
              className="flex w-full items-center justify-between gap-2 mb-3 text-left"
              aria-expanded={showAchieved}
            >
              <span className="text-label uppercase font-medium text-ink-muted">
                Achieved ({achieved.length})
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={cn(
                  'text-ink-faint transition-transform duration-snap',
                  showAchieved ? 'rotate-180' : '',
                )}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {showAchieved && (
              <div className="flex flex-col gap-3">
                {achieved.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    activityClassName={resolveClassName(g)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Sticky + New Goal CTA */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #0A0C0F 55%, transparent)' }}
      >
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="pointer-events-auto w-full h-12 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
        >
          + New Goal
        </button>
      </div>

      {/* New Goal form */}
      <NewGoalForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        activityClasses={activityClasses}
        onCreate={handleCreate}
      />
    </div>
  );
}
