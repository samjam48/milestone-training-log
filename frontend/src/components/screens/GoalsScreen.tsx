// =============================================================================
// GoalsScreen — Goals & Planning tab
// -----------------------------------------------------------------------------
// F2.2: Ports the GoalsScreen.jsx prototype to strict TypeScript.
// WTL.F2: Weekly targets section + dual bottom actions (Weekly target / Big goal).
// Props: { engine: MilestoneEngineResult }
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, Goal, SafetyState, VolumeUnit, WeeklyTarget } from '../../types';
import type { WeeklyProgress } from '../../lib/engine';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GoalsScreenProps {
  engine: MilestoneEngineResult;
  /** When provided, clicking "Big goal" calls this instead of opening the inline form. */
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

function unitOptionsForActivity(activity: Activity | undefined): VolumeUnit[] {
  const options: VolumeUnit[] = ['sessions', 'minutes'];
  if (activity?.defaultVolumeUnit != null && !options.includes(activity.defaultVolumeUnit)) {
    options.push(activity.defaultVolumeUnit);
  }
  return options;
}

function resolveActivityName(
  target: WeeklyTarget,
  activities: Activity[],
  weeklyProgress: WeeklyProgress[],
): string {
  const fromTarget = (target as WeeklyTarget & { activityName?: string }).activityName;
  if (fromTarget != null) return fromTarget;
  if (target.activityId != null) {
    const activity = activities.find((a) => a.id === target.activityId);
    if (activity != null) return activity.name;
  }
  const progress = weeklyProgress.find((p) => p.weeklyTargetId === target.id);
  if (progress?.activityName != null) return progress.activityName;
  return 'Unknown activity';
}

function progressForTarget(
  target: WeeklyTarget,
  weeklyProgress: WeeklyProgress[],
): WeeklyProgress | undefined {
  return weeklyProgress.find((p) => p.weeklyTargetId === target.id);
}

function formatProgressText(progress: WeeklyProgress): string {
  return `${progress.value} / ${progress.target} ${progress.unit}`;
}

type WeeklyTargetEditorMode =
  | { kind: 'create' }
  | { kind: 'edit'; targetId: string };

interface WeeklyTargetEditorState {
  activityId: string;
  targetValue: string;
  targetUnit: VolumeUnit;
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
// WeeklyTargetEditor
// ---------------------------------------------------------------------------

interface WeeklyTargetEditorProps {
  activities: Activity[];
  mode: WeeklyTargetEditorMode;
  initial: WeeklyTargetEditorState;
  mutationError: string | null;
  mutationPending: boolean;
  onClearMutationError: () => void;
  onCancel: () => void;
  onSave: (draft: { activityId: string; targetValue: number; targetUnit: VolumeUnit }) => void;
  onSaveEdit: (patch: { targetValue: number; activityId?: string; targetUnit?: VolumeUnit }) => void;
}

function WeeklyTargetEditor({
  activities,
  mode,
  initial,
  mutationError,
  mutationPending,
  onClearMutationError,
  onCancel,
  onSave,
  onSaveEdit,
}: WeeklyTargetEditorProps): React.ReactElement {
  const [activityId, setActivityId] = React.useState(initial.activityId);
  const [targetValue, setTargetValue] = React.useState(initial.targetValue);
  const [targetUnit, setTargetUnit] = React.useState<VolumeUnit>(initial.targetUnit);
  const [submitLocked, setSubmitLocked] = React.useState(false);
  const submitLockedRef = React.useRef(false);
  const observedPendingRef = React.useRef(false);

  const selectedActivity = activities.find((a) => a.id === activityId);
  const unitOptions = unitOptionsForActivity(selectedActivity);
  const saveDisabled = mutationPending || submitLocked;

  React.useEffect(() => {
    if (!unitOptions.includes(targetUnit)) {
      setTargetUnit(unitOptions[0] ?? 'sessions');
    }
  }, [activityId, selectedActivity, targetUnit, unitOptions]);

  React.useEffect(() => {
    if (mutationPending) {
      observedPendingRef.current = true;
      return;
    }

    if (mutationError != null || observedPendingRef.current) {
      submitLockedRef.current = false;
      observedPendingRef.current = false;
      setSubmitLocked(false);
    }
  }, [mutationError, mutationPending]);

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (mutationPending || submitLockedRef.current) return;
    onClearMutationError();
    const parsedValue = Number(targetValue);
    if (!Number.isFinite(parsedValue) || activityId === '') return;

    submitLockedRef.current = true;
    setSubmitLocked(true);

    if (mode.kind === 'create') {
      onSave({ activityId, targetValue: parsedValue, targetUnit });
      return;
    }

    const patch: { targetValue: number; activityId?: string; targetUnit?: VolumeUnit } = {
      targetValue: parsedValue,
    };
    if (activityId !== initial.activityId) {
      patch.activityId = activityId;
    }
    if (targetUnit !== initial.targetUnit) {
      patch.targetUnit = targetUnit;
    }
    onSaveEdit(patch);
  }

  return (
    <div
      data-testid="weekly-target-editor"
      className="rounded-md border border-border bg-bg-raised p-4 mb-4"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mutationError != null && (
          <div role="alert" className="text-caption text-danger-fg">
            {mutationError}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-caption font-medium text-ink-muted">Activity</span>
          <select
            aria-label="Activity"
            value={activityId}
            onChange={(event) => setActivityId(event.target.value)}
            className="h-10 rounded-md border border-border bg-bg px-3 text-body text-ink"
          >
            <option value="">Select activity</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption font-medium text-ink-muted">Target value</span>
          <input
            type="number"
            aria-label="Target value"
            min={0}
            step="any"
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
            className="h-10 rounded-md border border-border bg-bg px-3 text-body text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption font-medium text-ink-muted">Unit</span>
          <select
            aria-label="Unit"
            value={targetUnit}
            onChange={(event) => setTargetUnit(event.target.value as VolumeUnit)}
            className="h-10 rounded-md border border-border bg-bg px-3 text-body text-ink"
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 px-4 rounded-md text-body font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveDisabled}
            className="h-10 px-4 rounded-md text-body font-medium text-ink-inverse bg-ink hover:opacity-90 transition-opacity duration-snap"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WeeklyTargetCard
// ---------------------------------------------------------------------------

interface WeeklyTargetCardProps {
  target: WeeklyTarget;
  activityName: string;
  progress: WeeklyProgress | undefined;
  confirmingDelete: boolean;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function WeeklyTargetCard({
  target,
  activityName,
  progress,
  confirmingDelete,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: WeeklyTargetCardProps): React.ReactElement {
  const progressText = progress != null
    ? formatProgressText(progress)
    : `${target.targetValue} ${target.targetUnit}`;

  return (
    <Card pad="md" data-testid={`weekly-target-card-${target.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-body-lg font-semibold text-ink leading-snug">{activityName}</p>
          <p className="text-caption text-ink-muted mt-1">{progressText}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {confirmingDelete ? (
            <>
              <span className="text-caption text-ink-muted">Confirm delete?</span>
              <button
                type="button"
                onClick={onDeleteCancel}
                className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDeleteConfirm}
                className="h-8 px-3 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
              >
                Confirm
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDeleteRequest}
                className="h-8 px-3 rounded-md text-caption font-medium text-ink-faint hover:text-ink-muted transition-colors duration-snap"
              >
                Delete
              </button>
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
  const {
    goals,
    activityClasses,
    activities,
    weeklyTargets,
    weeklyProgress,
    archiveGoal,
    updateGoal,
    createWeeklyTarget,
    patchWeeklyTarget,
    deleteWeeklyTarget,
    weeklyTargetMutationPending,
    weeklyTargetMutationError,
    clearWeeklyTargetMutationError,
  } = engine;

  const classMap = React.useMemo(
    () => new Map(activityClasses.map((c) => [c.id, c])),
    [activityClasses],
  );

  const activeActivities = React.useMemo(
    () => activities.filter((a) => a.isActive),
    [activities],
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
  const [editorMode, setEditorMode] = React.useState<WeeklyTargetEditorMode | null>(null);
  const [editorInitial, setEditorInitial] = React.useState<WeeklyTargetEditorState>({
    activityId: '',
    targetValue: '',
    targetUnit: 'sessions',
  });
  const [confirmDeleteTargetId, setConfirmDeleteTargetId] = React.useState<string | null>(null);
  const weeklyTargetsCountRef = React.useRef(weeklyTargets.length);

  React.useEffect(() => {
    if (
      editorMode?.kind === 'create' &&
      weeklyTargetMutationError == null &&
      weeklyTargets.length > weeklyTargetsCountRef.current
    ) {
      setEditorMode(null);
    }
    weeklyTargetsCountRef.current = weeklyTargets.length;
  }, [editorMode, weeklyTargetMutationError, weeklyTargets.length]);

  React.useEffect(() => {
    if (editorMode?.kind === 'edit' && weeklyTargetMutationError == null) {
      const target = weeklyTargets.find((t) => t.id === editorMode.targetId);
      if (target == null) return;

      const valueChanged = editorInitial.targetValue !== String(target.targetValue);
      const activityChanged = editorInitial.activityId !== (target.activityId ?? '');
      const unitChanged = editorInitial.targetUnit !== target.targetUnit;

      if (valueChanged || activityChanged || unitChanged) {
        setEditorMode(null);
      }
    }
  }, [
    editorMode,
    editorInitial.activityId,
    editorInitial.targetUnit,
    editorInitial.targetValue,
    weeklyTargetMutationError,
    weeklyTargets,
  ]);

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

  function openCreateEditor(): void {
    clearWeeklyTargetMutationError();
    const firstActivity = activeActivities[0];
    const defaultUnit = firstActivity != null
      ? (unitOptionsForActivity(firstActivity)[0] ?? 'sessions')
      : 'sessions';
    setEditorInitial({
      activityId: firstActivity?.id ?? '',
      targetValue: '',
      targetUnit: defaultUnit,
    });
    setEditorMode({ kind: 'create' });
  }

  function openEditEditor(target: WeeklyTarget): void {
    clearWeeklyTargetMutationError();
    setEditorInitial({
      activityId: target.activityId ?? '',
      targetValue: String(target.targetValue),
      targetUnit: target.targetUnit,
    });
    setEditorMode({ kind: 'edit', targetId: target.id });
  }

  function closeEditor(): void {
    clearWeeklyTargetMutationError();
    setEditorMode(null);
  }

  function handleCreateSave(draft: {
    activityId: string;
    targetValue: number;
    targetUnit: VolumeUnit;
  }): void {
    createWeeklyTarget({
      activityId: draft.activityId,
      targetValue: draft.targetValue,
      targetUnit: draft.targetUnit,
    });
  }

  function handleEditSave(patch: {
    targetValue: number;
    activityId?: string;
    targetUnit?: VolumeUnit;
  }): void {
    if (editorMode?.kind !== 'edit') return;
    patchWeeklyTarget(editorMode.targetId, patch);
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
        {/* Weekly targets — always visible (WTL.F2) */}
        <section data-testid="weekly-targets-section" className="mb-6">
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Weekly targets
          </p>

          {editorMode != null && (
            <WeeklyTargetEditor
              key={editorMode.kind === 'edit' ? `edit-${editorMode.targetId}` : 'create'}
              activities={activeActivities}
              mode={editorMode}
              initial={editorInitial}
              mutationError={weeklyTargetMutationError}
              mutationPending={weeklyTargetMutationPending}
              onClearMutationError={clearWeeklyTargetMutationError}
              onCancel={closeEditor}
              onSave={handleCreateSave}
              onSaveEdit={handleEditSave}
            />
          )}

          {weeklyTargets.length === 0 ? (
            <p className="text-body text-ink-muted">No weekly targets yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {weeklyTargets.map((target) => (
                <WeeklyTargetCard
                  key={target.id}
                  target={target}
                  activityName={resolveActivityName(target, activities, weeklyProgress)}
                  progress={progressForTarget(target, weeklyProgress)}
                  confirmingDelete={confirmDeleteTargetId === target.id}
                  onEdit={() => openEditEditor(target)}
                  onDeleteRequest={() => setConfirmDeleteTargetId(target.id)}
                  onDeleteConfirm={() => {
                    deleteWeeklyTarget(target.id);
                    setConfirmDeleteTargetId(null);
                  }}
                  onDeleteCancel={() => setConfirmDeleteTargetId(null)}
                />
              ))}
            </div>
          )}
        </section>

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

      {/* Bottom action bar — WTL.F2 dual actions */}
      <div
        data-testid="bottom-action-bar"
        className="shrink-0 border-t border-border bg-bg-raised px-4 py-3"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreateEditor}
            className="flex-1 h-12 rounded-md bg-bg-sunken text-ink text-body-lg font-semibold transition-colors duration-snap hover:bg-bg-overlay active:opacity-80"
          >
            Weekly target
          </button>
          <button
            type="button"
            onClick={() => onNewGoal?.()}
            className="flex-1 h-12 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
          >
            Big goal
          </button>
        </div>
      </div>
    </div>
  );
}
