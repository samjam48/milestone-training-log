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
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Goal, SafetyState } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GoalsScreenProps {
  engine: MilestoneEngineResult;
  /** When provided, clicking "+ New Goal" calls this instead of opening the inline form. */
  onNewGoal?: () => void;
  /** When provided, clicking "Edit" on an active goal calls this with the goal object. */
  onEditGoal?: (goal: Omit<Goal, 'userId'>) => void;
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
  /** When true, show inline confirm/cancel UI instead of the Archive button. */
  confirmingArchive?: boolean;
  onArchiveConfirm?: (id: string) => void;
  onArchiveCancel?: () => void;
}

function GoalCard({ goal, activityClassName, onEdit, onArchive, confirmingArchive, onArchiveConfirm, onArchiveCancel }: GoalCardProps): React.ReactElement {
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
          {confirmingArchive ? (
            <>
              <span className="text-caption text-ink-muted">Confirm archive?</span>
              <button
                type="button"
                onClick={() => onArchiveCancel?.()}
                className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onArchiveConfirm?.(goal.id)}
                className="h-8 px-3 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
              >
                Confirm
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GoalsScreen
// ---------------------------------------------------------------------------

export function GoalsScreen({ engine, onNewGoal, onEditGoal }: GoalsScreenProps): React.ReactElement {
  const { goals, activityClasses, archiveGoal, updateGoal } = engine;

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
  const paused = React.useMemo(
    () => goals.filter((g) => g.status === 'paused'),
    [goals],
  );
  const hasActive = monthly.length > 0 || quarterly.length > 0;

  const [showAchieved, setShowAchieved] = React.useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = React.useState<string | null>(null);

  function resolveClassName(goal: Omit<Goal, 'userId'>): string | null {
    if (goal.activityClassId == null) return null;
    return classMap.get(goal.activityClassId)?.name ?? null;
  }

  function handleArchiveRequest(id: string): void {
    setConfirmArchiveId(id);
  }

  function handleArchiveConfirm(id: string): void {
    archiveGoal(id);
    setConfirmArchiveId(null);
  }

  function handleArchiveCancel(): void {
    setConfirmArchiveId(null);
  }

  function handleRestore(id: string): void {
    updateGoal(id, { status: 'active' });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <h1 className="text-title font-bold text-ink">Goals</h1>
        <p className="text-caption text-ink-muted mt-0.5">
          {monthly.length + quarterly.length} active
          {achieved.length > 0 ? ` · ${achieved.length} achieved` : ''}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {!hasActive ? (
          <div
            data-testid="goals-empty-state"
            className="flex flex-col items-center justify-center gap-3 text-center mt-16 px-4"
          >
            <div
              data-testid="goals-empty-illustration"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-sunken text-ink-faint"
              aria-hidden="true"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1.75" />
                <circle cx="20" cy="20" r="5" stroke="currentColor" strokeWidth="1.75" />
                <path d="M20 4v4M20 32v4M4 20h4M32 20h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
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
                      onEdit={onEditGoal ? () => onEditGoal(g) : () => undefined}
                      onArchive={handleArchiveRequest}
                      confirmingArchive={confirmArchiveId === g.id}
                      onArchiveConfirm={handleArchiveConfirm}
                      onArchiveCancel={handleArchiveCancel}
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
                      onEdit={onEditGoal ? () => onEditGoal(g) : () => undefined}
                      onArchive={handleArchiveRequest}
                      confirmingArchive={confirmArchiveId === g.id}
                      onArchiveConfirm={handleArchiveConfirm}
                      onArchiveCancel={handleArchiveCancel}
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

        {/* Paused — always visible */}
        {paused.length > 0 && (
          <section className="mt-6">
            <p className="text-label uppercase font-medium text-ink-muted mb-3">
              Archived ({paused.length})
            </p>
            <div className="flex flex-col gap-3">
              {paused.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-md bg-bg-sunken border border-border">
                  <p className="text-body font-medium text-ink truncate">{g.title}</p>
                  <button
                    type="button"
                    onClick={() => handleRestore(g.id)}
                    className="shrink-0 h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-raised hover:bg-bg-overlay transition-colors duration-snap"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        data-testid="bottom-action-bar"
        className="shrink-0 border-t border-border bg-bg-raised px-4 py-3"
      >
        <button
          type="button"
          onClick={() => onNewGoal?.()}
          className="w-full h-12 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
        >
          + New Goal
        </button>
      </div>
    </div>
  );
}
