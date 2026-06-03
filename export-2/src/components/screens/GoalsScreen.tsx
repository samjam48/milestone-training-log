// =============================================================================
// GoalsScreen — Tier 3  (v2)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Goal } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onNewGoal?: () => void;
  onEditGoal?: (goal: Goal) => void;
}

// ---------------------------------------------------------------------------
// GoalCard
// ---------------------------------------------------------------------------

function goalProgressState(value?: number, target?: number): 'safe' | 'caution' | 'neutral' {
  if (value == null || !target) return 'neutral';
  const r = value / target;
  if (r >= 1)   return 'safe';
  if (r >= 0.4) return 'caution';
  return 'neutral';
}

interface GoalCardProps {
  goal: Goal;
  activityClassName: string | null;
  onEdit?: () => void;
  onArchive?: (id: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, activityClassName, onEdit, onArchive }) => {
  const hasProgress  = goal.progressValue != null && goal.progressTarget != null && goal.progressTarget > 0;
  const state        = goalProgressState(goal.progressValue, goal.progressTarget);
  const valueText    = hasProgress
    ? `${goal.progressValue} / ${goal.progressTarget} ${goal.progressUnit ?? ''}`
    : undefined;
  const dueFmt       = goal.targetDate
    ? new Date(goal.targetDate + 'T00:00:00Z').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      })
    : null;

  return (
    <Card pad="md">
      <div className="mb-3">
        <p className="text-body-lg font-semibold text-ink leading-snug">{goal.title}</p>
        {activityClassName && (
          <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium bg-bg-sunken text-ink-muted mt-1.5">
            {activityClassName}
          </span>
        )}
      </div>

      {hasProgress ? (
        <div className="mb-3">
          <ProgressBar
            value={goal.progressValue!}
            target={goal.progressTarget!}
            state={state}
            valueText={valueText}
          />
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-pill bg-bg-sunken" aria-hidden="true" />
          <span className="text-caption text-ink-faint shrink-0">Qualitative</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-ink-muted">{dueFmt ? `Due ${dueFmt}` : ''}</span>
        <div className="flex gap-1.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
            >
              Edit
            </button>
          )}
          {onArchive && (
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
};

// ---------------------------------------------------------------------------
// GoalsScreen
// ---------------------------------------------------------------------------

export const GoalsScreen: React.FC<Props> = ({ engine, onNewGoal, onEditGoal }) => {
  const { goals, activityClasses, archiveGoal } = engine;

  const classMap = React.useMemo(
    () => new Map(activityClasses.map(c => [c.id, c])),
    [activityClasses],
  );

  const monthly   = React.useMemo(() => goals.filter(g => g.status === 'active' && g.timeframe === 'monthly'),   [goals]);
  const quarterly = React.useMemo(() => goals.filter(g => g.status === 'active' && g.timeframe === 'quarterly'), [goals]);
  const achieved  = React.useMemo(() => goals.filter(g => g.status === 'achieved'), [goals]);
  const hasActive = monthly.length > 0 || quarterly.length > 0;

  const [showAchieved, setShowAchieved] = React.useState(false);

  function getClassName(goal: Goal): string | null {
    return goal.activityClassId ? (classMap.get(goal.activityClassId)?.name ?? null) : null;
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

      {/* Scrollable body — pb-24 clears sticky CTA */}
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

            {monthly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">This month</p>
                <div className="flex flex-col gap-3">
                  {monthly.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={getClassName(g)}
                      onEdit={onEditGoal ? () => onEditGoal(g) : undefined}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

            {quarterly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">This quarter</p>
                <div className="flex flex-col gap-3">
                  {quarterly.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={getClassName(g)}
                      onEdit={onEditGoal ? () => onEditGoal(g) : undefined}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

            {achieved.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowAchieved(s => !s)}
                  className="flex w-full items-center justify-between gap-2 mb-3 text-left"
                >
                  <span className="text-label uppercase font-medium text-ink-muted">
                    Achieved ({achieved.length})
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                    className={cn('text-ink-faint transition-transform duration-snap', showAchieved ? 'rotate-180' : '')}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showAchieved && (
                  <div className="flex flex-col gap-3">
                    {achieved.map(g => (
                      <GoalCard key={g.id} goal={g} activityClassName={getClassName(g)} />
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>

      {/* Sticky + New Goal CTA */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #0A0C0F 55%, transparent)' }}
      >
        <button
          type="button"
          onClick={onNewGoal}
          className="pointer-events-auto w-full h-12 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
        >
          + New Goal
        </button>
      </div>

    </div>
  );
};
