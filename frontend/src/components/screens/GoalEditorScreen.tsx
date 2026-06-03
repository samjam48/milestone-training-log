// =============================================================================
// GoalEditorScreen — Tier 3 (F8.4)
// -----------------------------------------------------------------------------
// Create or edit a Goal. Pushed onto the navigation stack from GoalsScreen.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { MilestoneEngineResult, GoalDraft, GoalPatch } from '../../hooks/useMilestoneEngine';
import type { Goal, VolumeUnit, GoalTimeframe, ISODate } from '../../types';

export interface GoalEditorScreenProps {
  goal?: Omit<Goal, 'userId'> | null;
  engine: MilestoneEngineResult;
  onBack: () => void;
  onComplete: () => void;
}

const TIMEFRAME_OPTS: Array<{ value: GoalTimeframe; label: string; tone: 'neutral' }> = [
  { value: 'monthly',   label: 'Monthly',   tone: 'neutral' },
  { value: 'quarterly', label: 'Quarterly', tone: 'neutral' },
];

const VOLUME_UNITS: VolumeUnit[] = ['km', 'mi', 'm', 'minutes', 'reps', 'sets', 'sessions'];

export function GoalEditorScreen({
  goal,
  engine,
  onBack,
  onComplete,
}: GoalEditorScreenProps): React.ReactElement {
  const { activityClasses, createGoal, updateGoal } = engine;
  const isEdit = goal != null;

  const [title,         setTitle]         = React.useState(goal?.title ?? '');
  const [timeframe,     setTimeframe]     = React.useState<GoalTimeframe>(goal?.timeframe ?? 'monthly');
  const [targetDate,    setTargetDate]    = React.useState<string>(goal?.targetDate ?? '');
  const [classId,       setClassId]       = React.useState<string>(goal?.activityClassId ?? '');
  const [hasProgress,   setHasProgress]   = React.useState<boolean>(goal?.progressTarget != null);
  const [progressValue, setProgressValue] = React.useState<number | ''>(goal?.progressValue ?? '');
  const [progressTarget, setProgressTarget] = React.useState<number | ''>(goal?.progressTarget ?? '');
  const [progressUnit,  setProgressUnit]  = React.useState<VolumeUnit>(goal?.progressUnit ?? 'km');

  const canSave = title.trim().length > 0 && targetDate !== '';

  function handleSave(): void {
    if (!canSave) return;

    if (isEdit && goal != null) {
      // Build patch with only changed fields
      const patch: GoalPatch = {};

      if (title.trim() !== goal.title) {
        patch.title = title.trim();
      }
      if (timeframe !== goal.timeframe) {
        patch.timeframe = timeframe;
      }
      if (targetDate !== goal.targetDate) {
        patch.targetDate = targetDate as ISODate;
      }
      // activityClassId: '' means none (undefined)
      const newClassId = classId !== '' ? classId : undefined;
      if (newClassId !== goal.activityClassId) {
        patch.activityClassId = newClassId;
      }
      // Numeric progress
      if (hasProgress) {
        const newProgressTarget = progressTarget !== '' ? Number(progressTarget) : undefined;
        const newProgressValue  = progressValue  !== '' ? Number(progressValue)  : undefined;
        if (newProgressTarget !== goal.progressTarget) {
          patch.progressTarget = newProgressTarget;
        }
        if (newProgressValue !== goal.progressValue) {
          patch.progressValue = newProgressValue;
        }
        if (progressUnit !== goal.progressUnit) {
          patch.progressUnit = progressUnit;
        }
      } else {
        // Progress was toggled off or was never on
        if (goal.progressTarget != null) {
          patch.progressTarget = undefined;
        }
        if (goal.progressValue != null) {
          patch.progressValue = undefined;
        }
        if (goal.progressUnit != null) {
          patch.progressUnit = undefined;
        }
      }

      updateGoal(goal.id, patch);
    } else {
      // Create
      const draft: GoalDraft = {
        title:     title.trim(),
        targetDate: targetDate as ISODate,
        timeframe,
        status:    'active',
      };

      if (classId !== '') {
        draft.activityClassId = classId;
      }

      if (hasProgress) {
        if (progressValue !== '') {
          draft.progressValue = Number(progressValue);
        }
        if (progressTarget !== '') {
          draft.progressTarget = Number(progressTarget);
        }
        draft.progressUnit = progressUnit;
      }

      createGoal(draft);
    }

    onComplete();
  }

  return (
    <div className="flex flex-col bg-bg" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors"
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
        <h1 className="text-title font-bold text-ink flex-1">
          {isEdit ? 'Edit Goal' : 'New Goal'}
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            'h-9 px-4 rounded-md text-body font-semibold transition-colors',
            canSave
              ? 'bg-ink text-ink-inverse'
              : 'bg-ink/20 text-ink-faint cursor-not-allowed',
          )}
        >
          {isEdit ? 'Save' : 'Create'}
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-5 flex flex-col gap-6 pb-12">

        {/* Title */}
        <div>
          <label
            htmlFor="goal-title"
            className="block text-body font-medium text-ink mb-2"
          >
            Goal
          </label>
          <input
            id="goal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
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
            onChange={(v) => setTimeframe(v as GoalTimeframe)}
            options={TIMEFRAME_OPTS}
            ariaLabel="Goal timeframe"
          />
        </div>

        {/* Target date */}
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
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
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
            Activity class{' '}
            <span className="text-ink-faint font-normal">(optional)</span>
          </p>
          <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setClassId('')}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                !classId ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
              )}
            >
              <p className={cn('text-body font-medium', !classId ? 'text-ink' : 'text-ink-muted')}>
                None
              </p>
              {!classId && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                  <path
                    d="M3 8l3.5 3.5L13 4"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            {activityClasses.map((cls) => {
              const sel = classId === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setClassId(cls.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                    sel ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn('text-body font-medium', sel ? 'text-ink' : 'text-ink-muted')}>
                      {cls.name}
                    </p>
                    <p className="text-caption text-ink-faint capitalize">{cls.type}</p>
                  </div>
                  {sel && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                      <path
                        d="M3 8l3.5 3.5L13 4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
            <p className="text-body font-medium text-ink" id="numeric-progress-label">
              Track numeric progress
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={hasProgress}
              aria-labelledby="numeric-progress-label"
              onClick={() => setHasProgress((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                hasProgress ? 'bg-safe' : 'bg-bg-sunken border border-border',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full shadow transition-transform',
                  hasProgress ? 'bg-ink-inverse translate-x-5' : 'bg-ink-faint translate-x-1',
                )}
              />
            </button>
          </div>

          {hasProgress && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Current / progressValue */}
                <div>
                  <label
                    htmlFor="goal-progress-value"
                    className="block text-caption text-ink-muted mb-1.5"
                  >
                    Current
                  </label>
                  <input
                    id="goal-progress-value"
                    type="number"
                    min={0}
                    value={progressValue}
                    onChange={(e) =>
                      setProgressValue(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className={cn(
                      'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                      'text-body text-ink focus:outline-none focus:border-border-strong',
                    )}
                  />
                </div>
                {/* Target / progressTarget */}
                <div>
                  <label
                    htmlFor="goal-progress-target"
                    className="block text-caption text-ink-muted mb-1.5"
                  >
                    Target
                  </label>
                  <input
                    id="goal-progress-target"
                    type="number"
                    min={1}
                    value={progressTarget}
                    onChange={(e) =>
                      setProgressTarget(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className={cn(
                      'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                      'text-body text-ink focus:outline-none focus:border-border-strong',
                    )}
                  />
                </div>
              </div>
              {/* Unit / progressUnit */}
              <div>
                <p className="text-caption text-ink-muted mb-1.5">Unit</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {VOLUME_UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={progressUnit === u}
                      onClick={() => setProgressUnit(u)}
                      className={cn(
                        'h-9 rounded-md text-body font-medium transition-colors border',
                        progressUnit === u
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
}
