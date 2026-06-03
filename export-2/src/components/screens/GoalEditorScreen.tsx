// =============================================================================
// GoalEditorScreen — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Create or edit a Goal. Pushed onto the navigation stack from GoalsScreen.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { MilestoneEngineResult, GoalDraft } from '../../hooks/useMilestoneEngine';
import type { Goal, VolumeUnit, GoalTimeframe } from '../../types';

interface Props {
  goal?:       Goal | null;
  engine:      MilestoneEngineResult;
  onBack:      () => void;
  onComplete:  () => void;
}

const TIMEFRAME_OPTS: Array<{ value: GoalTimeframe; label: string; tone: 'neutral' }> = [
  { value: 'monthly',   label: 'Monthly',   tone: 'neutral' },
  { value: 'quarterly', label: 'Quarterly', tone: 'neutral' },
];

const UNIT_OPTS: VolumeUnit[] = ['km', 'mi', 'sessions', 'sets', 'minutes', 'reps'];

export const GoalEditorScreen: React.FC<Props> = ({ goal, engine, onBack, onComplete }) => {
  const { activityClasses, submitGoal, editGoal } = engine;
  const isEdit = !!goal;

  const [title,      setTitle]      = React.useState(goal?.title ?? '');
  const [timeframe,  setTimeframe]  = React.useState<GoalTimeframe>(goal?.timeframe ?? 'monthly');
  const [targetDate, setTargetDate] = React.useState(goal?.targetDate ?? '');
  const [classId,    setClassId]    = React.useState(goal?.activityClassId ?? '');
  const [hasTarget,  setHasTarget]  = React.useState(goal?.progressTarget != null);
  const [value,      setValue]      = React.useState(goal?.progressValue ?? 0);
  const [target,     setTarget]     = React.useState(goal?.progressTarget ?? 10);
  const [unit,       setUnit]       = React.useState<VolumeUnit>(goal?.progressUnit ?? 'km');

  const canSave = title.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const draft: GoalDraft = {
      title:           title.trim(),
      timeframe,
      targetDate:      targetDate || null,
      activityClassId: classId || null,
      progressValue:   hasTarget ? Number(value)  : null,
      progressTarget:  hasTarget ? Number(target) : null,
      progressUnit:    hasTarget ? unit           : null,
    };
    if (isEdit && goal) {
      editGoal(goal.id, draft);
    } else {
      submitGoal(draft);
    }
    onComplete();
  }

  return (
    <div className="flex flex-col bg-bg" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border shrink-0">
        <button
          type="button" onClick={onBack} aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-title font-bold text-ink flex-1">{isEdit ? 'Edit Goal' : 'New Goal'}</h1>
        <button
          type="button" onClick={handleSave} disabled={!canSave}
          className={cn(
            'h-9 px-4 rounded-md text-body font-semibold transition-colors duration-snap',
            canSave ? 'bg-ink text-ink-inverse' : 'bg-ink/20 text-ink-faint cursor-not-allowed',
          )}
        >
          {isEdit ? 'Save' : 'Create'}
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-5 flex flex-col gap-6 pb-12">

        {/* Title */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Goal</p>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus
            placeholder="e.g. Walk 20 km without flare-up"
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        {/* Timeframe */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Timeframe</p>
          <SegmentedControl
            value={timeframe}
            onChange={v => setTimeframe(v as GoalTimeframe)}
            options={TIMEFRAME_OPTS}
            ariaLabel="Goal timeframe"
          />
        </div>

        {/* Target date */}
        <div>
          <p className="text-body font-medium text-ink mb-2">
            Target date <span className="text-ink-faint font-normal">(optional)</span>
          </p>
          <input
            type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        {/* Activity class */}
        <div>
          <p className="text-body font-medium text-ink mb-2">
            Activity class <span className="text-ink-faint font-normal">(optional)</span>
          </p>
          <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
            <button
              type="button" onClick={() => setClassId('')}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                !classId ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
              )}
            >
              <p className={cn('text-body font-medium', !classId ? 'text-ink' : 'text-ink-muted')}>None</p>
              {!classId && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                  <path d="M3 8l3.5 3.5L13 4" stroke="#E8ECF1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {activityClasses.map(cls => {
              const sel = classId === cls.id;
              return (
                <button key={cls.id} type="button" onClick={() => setClassId(cls.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                    sel ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn('text-body font-medium', sel ? 'text-ink' : 'text-ink-muted')}>{cls.name}</p>
                    <p className="text-caption text-ink-faint capitalize">{cls.type}</p>
                  </div>
                  {sel && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                      <path d="M3 8l3.5 3.5L13 4" stroke="#E8ECF1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Numeric progress toggle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-body font-medium text-ink">Track numeric progress</p>
            <button
              type="button" role="switch" aria-checked={hasTarget}
              onClick={() => setHasTarget(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-snap',
                hasTarget ? 'bg-safe' : 'bg-bg-sunken border border-border',
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full shadow transition-transform duration-snap',
                hasTarget ? 'bg-ink-inverse translate-x-5' : 'bg-ink-faint translate-x-1',
              )} />
            </button>
          </div>

          {hasTarget && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-caption text-ink-muted mb-1.5">Current</p>
                  <input
                    type="number" min={0} value={value}
                    onChange={e => setValue(Number(e.target.value))}
                    className={cn(
                      'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                      'text-body text-ink focus:outline-none focus:border-border-strong',
                    )}
                  />
                </div>
                <div>
                  <p className="text-caption text-ink-muted mb-1.5">Target</p>
                  <input
                    type="number" min={1} value={target}
                    onChange={e => setTarget(Number(e.target.value))}
                    className={cn(
                      'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                      'text-body text-ink focus:outline-none focus:border-border-strong',
                    )}
                  />
                </div>
              </div>
              <div>
                <p className="text-caption text-ink-muted mb-1.5">Unit</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {UNIT_OPTS.map(u => (
                    <button key={u} type="button" onClick={() => setUnit(u)}
                      className={cn(
                        'h-9 rounded-md text-body font-medium transition-colors duration-snap border',
                        unit === u
                          ? 'bg-ink text-ink-inverse border-transparent'
                          : 'bg-bg-sunken text-ink-muted border-border hover:bg-bg-overlay',
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
