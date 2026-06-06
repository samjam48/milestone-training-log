// =============================================================================
// GoalEditorScreen — Tier 3 (F8.4)
// -----------------------------------------------------------------------------
// Create or edit a Goal. Pushed onto the navigation stack from GoalsScreen.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { BackButton } from '../ui/BackButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import {
  StackScreenEngineBody,
  stackScreenEngineBlocked,
} from '../ui/StackScreenEngineBody';
import type { MilestoneEngineResult, GoalDraft, GoalPatch } from '../../hooks/useMilestoneEngine';
import type { Goal, Activity, ActivityClass, VolumeUnit, GoalTimeframe, ISODate } from '../../types';

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

const VOLUME_UNITS: VolumeUnit[] = ['km', 'mi', 'm', 'kg', 'minutes', 'reps', 'sets', 'sessions'];

interface ActivityGroup {
  cls: ActivityClass;
  acts: Activity[];
}

function groupActivities(classes: ActivityClass[], activities: Activity[]): ActivityGroup[] {
  return classes.map((cls) => ({
    cls,
    acts: activities.filter((a) => a.activityClassId === cls.id && a.isActive),
  }));
}

function resolveInitialActivityId(
  goal: Omit<Goal, 'userId'> | null | undefined,
  activities: Activity[],
): string {
  if (goal?.activityId != null && goal.activityId !== '') {
    return goal.activityId;
  }
  if (goal?.activityClassId != null && goal.activityClassId !== '') {
    const matches = activities.filter(
      (a) => a.activityClassId === goal.activityClassId && a.isActive,
    );
    if (matches.length === 1) {
      return matches[0]!.id;
    }
  }
  return '';
}

export function GoalEditorScreen({
  goal,
  engine,
  onBack,
  onComplete,
}: GoalEditorScreenProps): React.ReactElement {
  const { activityClasses, activities, createGoal, updateGoal } = engine;
  const isEdit = goal != null;

  const [title, setTitle] = React.useState(goal?.title ?? '');
  const [timeframe, setTimeframe] = React.useState<GoalTimeframe>(goal?.timeframe ?? 'monthly');
  const [targetDate, setTargetDate] = React.useState<string>(goal?.targetDate ?? '');
  const [activityId, setActivityId] = React.useState<string>(
    () => resolveInitialActivityId(goal, activities),
  );
  const [hasProgress, setHasProgress] = React.useState<boolean>(goal?.progressTarget != null);
  const [autoTrackProgress, setAutoTrackProgress] = React.useState<boolean>(
    goal?.autoTrackProgress ?? false,
  );
  const [progressValue, setProgressValue] = React.useState<number | ''>(goal?.progressValue ?? '');
  const [progressTarget, setProgressTarget] = React.useState<number | ''>(goal?.progressTarget ?? '');
  const [progressUnit, setProgressUnit] = React.useState<VolumeUnit>(goal?.progressUnit ?? 'km');

  const groups = React.useMemo(
    () => groupActivities(activityClasses, activities),
    [activityClasses, activities],
  );

  const blocked = stackScreenEngineBlocked(engine, { skipLoading: isEdit });

  const showNumericFields = hasProgress || autoTrackProgress;
  const hasNumericTarget = showNumericFields && progressTarget !== '';
  const activityRequired = autoTrackProgress || hasNumericTarget;
  const activityMissing = activityRequired && activityId === '';
  const autoTrackTargetMissing = autoTrackProgress && progressTarget === '';
  const autoTrackIncomplete =
    autoTrackProgress &&
    (activityId === '' || progressTarget === '' || progressUnit === undefined);

  const baseValid = title.trim().length > 0 && targetDate !== '';
  const canSave = baseValid && !autoTrackIncomplete && !activityMissing && !blocked;

  function handleAutoTrackToggle(): void {
    setAutoTrackProgress((prev) => {
      const next = !prev;
      if (next) {
        setHasProgress(true);
      }
      return next;
    });
  }

  function applyProgressFields(
    target: GoalDraft | GoalPatch,
    includeCurrentValue: boolean,
  ): void {
    if (!showNumericFields) {
      return;
    }
    if (includeCurrentValue && progressValue !== '') {
      target.progressValue = Number(progressValue);
    }
    if (progressTarget !== '') {
      target.progressTarget = Number(progressTarget);
    }
    target.progressUnit = progressUnit;
  }

  function applyActivityFields(target: GoalDraft | GoalPatch): void {
    if (activityId !== '') {
      target.activityId = activityId;
      const act = activities.find((a) => a.id === activityId);
      if (act != null) {
        target.activityClassId = act.activityClassId;
      }
    }
  }

  function handleSave(): void {
    if (!canSave) return;

    if (isEdit && goal != null) {
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

      const newActivityId = activityId !== '' ? activityId : undefined;
      if (newActivityId !== goal.activityId) {
        patch.activityId = newActivityId;
      }

      const derivedClassId =
        newActivityId != null
          ? activities.find((a) => a.id === newActivityId)?.activityClassId
          : undefined;
      if (derivedClassId !== goal.activityClassId) {
        patch.activityClassId = derivedClassId;
      }

      if (autoTrackProgress !== (goal.autoTrackProgress ?? false)) {
        patch.autoTrackProgress = autoTrackProgress;
      }

      if (showNumericFields) {
        const newProgressTarget = progressTarget !== '' ? Number(progressTarget) : undefined;
        const newProgressValue = progressValue !== '' ? Number(progressValue) : undefined;
        if (newProgressTarget !== goal.progressTarget) {
          patch.progressTarget = newProgressTarget;
        }
        if (newProgressValue !== goal.progressValue) {
          patch.progressValue = newProgressValue;
        }
        if (progressUnit !== goal.progressUnit) {
          patch.progressUnit = progressUnit;
        }
      } else if (goal.progressTarget != null) {
        patch.progressTarget = undefined;
        patch.progressValue = undefined;
        patch.progressUnit = undefined;
      }

      updateGoal(goal.id, patch);
    } else {
      const draft: GoalDraft = {
        title: title.trim(),
        targetDate: targetDate as ISODate,
        timeframe,
        status: 'active',
      };

      applyActivityFields(draft);

      if (autoTrackProgress) {
        draft.autoTrackProgress = true;
      }

      applyProgressFields(draft, true);

      createGoal(draft);
    }

    onComplete();
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3">
        <BackButton onPress={onBack} />
        <h1 className="text-title font-bold text-ink flex-1">
          {isEdit ? 'Edit Goal' : 'New Goal'}
        </h1>
      </header>

      <StackScreenEngineBody engine={engine} skipLoading={isEdit}>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">

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

          {/* Activity picker — grouped by class */}
          <div>
            <p className="text-body font-medium text-ink mb-2">
              Activity{' '}
              <span className="text-ink-faint font-normal">
                {activityRequired ? '(required)' : '(optional)'}
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActivityId('')}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                    activityId === '' ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                  )}
                >
                  <p
                    className={cn(
                      'text-body font-medium',
                      activityId === '' ? 'text-ink' : 'text-ink-muted',
                    )}
                  >
                    None
                  </p>
                  {activityId === '' && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="shrink-0"
                      aria-hidden="true"
                    >
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
              </div>

              {groups.map(({ cls, acts }) => (
                <div key={cls.id} role="group" aria-label={cls.name}>
                  <p className="text-label uppercase font-medium text-ink-muted mb-1.5">
                    {cls.name}
                  </p>
                  <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
                    {acts.map((act) => {
                      const selected = activityId === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={act.name}
                          onClick={() => setActivityId(act.id)}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                            selected ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                          )}
                        >
                          <span
                            className={cn(
                              'text-body font-medium',
                              selected ? 'text-ink' : 'text-ink-muted',
                            )}
                          >
                            {act.name}
                          </span>
                          {selected && (
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                              className="shrink-0"
                              aria-hidden="true"
                            >
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
              ))}
            </div>
            {activityMissing && (
              <p className="mt-2 text-caption text-caution">Select an activity</p>
            )}
          </div>

          {/* Track automatically */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-body font-medium text-ink" id="auto-track-label">
                Track automatically
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={autoTrackProgress}
                aria-labelledby="auto-track-label"
                onClick={handleAutoTrackToggle}
                className={cn(
                  'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                  autoTrackProgress ? 'bg-safe' : 'bg-bg-sunken border border-border',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full shadow transition-transform',
                    autoTrackProgress
                      ? 'bg-ink-inverse translate-x-5'
                      : 'bg-ink-faint translate-x-1',
                  )}
                />
              </button>
            </div>
            <p className="mt-1 text-caption text-ink-faint">
              Progress updates from matching activity logs when enabled.
            </p>
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

            {showNumericFields && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
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
                    {autoTrackTargetMissing && (
                      <p className="mt-1.5 text-caption text-caution">Enter a target</p>
                    )}
                  </div>
                </div>
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
      </StackScreenEngineBody>

      {!blocked ? (
        <div
          data-testid="bottom-action-bar"
          className="shrink-0 border-t border-border bg-bg px-4 py-3 pb-safe-bottom"
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'h-12 w-full rounded-md text-body-lg font-semibold transition-colors',
              canSave
                ? 'bg-ink text-ink-inverse active:opacity-80'
                : 'cursor-not-allowed bg-ink/20 text-ink-faint',
            )}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
