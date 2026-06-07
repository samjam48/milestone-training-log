// =============================================================================
// SettingsScreen — Training block & app settings screen
// -----------------------------------------------------------------------------
// F2.3: Ports the SettingsScreen.jsx prototype to strict TypeScript.
// Props: { engine: MilestoneEngineResult }
// =============================================================================

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { CenteredModal } from '../ui/CenteredModal';
import { ReviewMilestoneBadge } from '../ui/ReviewMilestoneBadge';
import { apiFetch, ApiError } from '../../lib/api/client';
import type {
  MilestoneEngineResult,
  NewActivityClassDraft,
  NewActivityDraft,
  ActivityClassPatch,
} from '../../hooks/useMilestoneEngine';
import { ACTIVITY_VOLUME_UNIT_OPTIONS } from './activityVolumeUnits';
import { formatSettingsRuleSummary } from '../../lib/ruleTaxonomy';
import type {
  Activity,
  ActivityClass,
  ActivityLog,
  ActivityType,
  ID,
  Rule,
  VolumeUnit,
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
  onOpenNewActivity?: () => void;
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

function formatCalendarWeekRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

// ---------------------------------------------------------------------------
// WeeklyRulesSummaryCard
// ---------------------------------------------------------------------------

interface WeeklyRulesSummaryCardProps {
  block: TrainingBlock;
  rules: Rule[];
  activityClasses: ActivityClass[];
  activities: Activity[];
  /** Whether the Edit rules CTA should be rendered. */
  showEditRules: boolean;
  onEditRules: () => void;
  onReview?: () => void;
}

function WeeklyRulesSummaryCard({
  block,
  rules,
  activityClasses,
  activities,
  showEditRules,
  onEditRules,
  onReview,
}: WeeklyRulesSummaryCardProps): React.ReactElement {
  const classMap = new Map(activityClasses.map((c) => [c.id, c]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const activeRules = rules.filter((r) => r.enabled);
  const visibleRecoveryRules = activeRules
    .map((rule) => ({
      rule,
      summary: formatSettingsRuleSummary(rule.ruleType, rule.thresholdValue),
    }))
    .filter((entry): entry is { rule: Rule; summary: string } => entry.summary != null);

  return (
    <Card pad="md">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <CardTitle>
            {formatCalendarWeekRange(
              block.startDate,
              block.endDate ?? block.startDate,
            )}
          </CardTitle>
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

      {/* Recovery rules */}
      {visibleRecoveryRules.length > 0 && (
        <div className="mb-4 pt-3 border-t border-border-subtle">
          <p className="text-label uppercase font-medium text-ink-faint mb-2">Recovery Rules</p>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {visibleRecoveryRules.map(({ rule, summary }) => {
              const cls = rule.activityClassId ? classMap.get(rule.activityClassId) : null;
              const activity = rule.activityId ? activityMap.get(rule.activityId) : null;
              return (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-3 py-2 text-body"
                >
                  <span className="text-ink-muted truncate">
                    {activity ? activity.name : cls ? cls.name : 'All classes'}
                  </span>
                  <span className="text-ink shrink-0">{summary}</span>
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
// PreviousWeeksModal
// ---------------------------------------------------------------------------

interface PreviousWeeksModalProps {
  open: boolean;
  previousBlocks: TrainingBlock[];
  onClose: () => void;
  onViewBlock: (blockId: ID) => void;
}

function PreviousWeeksModal({
  open,
  previousBlocks,
  onClose,
  onViewBlock,
}: PreviousWeeksModalProps): React.ReactElement | null {
  if (!open) return null;

  const hasEarlierWeeks = previousBlocks.length > 1;

  return (
    <CenteredModal open onClose={onClose} ariaLabel="Previous weeks">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-title font-bold text-ink">Previous weeks</h2>
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

      {hasEarlierWeeks ? (
        <div className="flex flex-col divide-y divide-border-subtle -mx-1">
          {previousBlocks.map((pb) => (
            <button
              key={pb.id}
              type="button"
              onClick={() => onViewBlock(pb.id)}
              className="flex items-center justify-between gap-3 px-1 py-3 text-left transition-colors duration-snap hover:bg-bg-overlay rounded-md"
            >
              <span className="min-w-0 flex-1 text-body font-medium text-ink">
                {formatCalendarWeekRange(
                  pb.startDate,
                  pb.endDate ?? pb.startDate,
                )}
              </span>
              {pb.isReviewMilestoneHit ? <ReviewMilestoneBadge compact /> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-body text-ink-muted">
          No earlier weeks to show.
        </p>
      )}
    </CenteredModal>
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
    <CenteredModal open={open} onClose={onClose} ariaLabel="New activity class">
      <form onSubmit={(e) => { void handleSubmit(e); }}>
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
    </CenteredModal>
  );
}

// ---------------------------------------------------------------------------
// EditActivityClassForm — rename + type
// ---------------------------------------------------------------------------

interface EditActivityClassFormProps {
  activityClass: ActivityClass | null;
  onClose: () => void;
  onSubmit: (classId: ID, patch: ActivityClassPatch) => Promise<void>;
}

function EditActivityClassForm({
  activityClass,
  onClose,
  onSubmit,
}: EditActivityClassFormProps): React.ReactElement | null {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<ActivityType>('performance');
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (activityClass != null) {
      setName(activityClass.name);
      setType(activityClass.type);
      setApiError(null);
      setSubmitting(false);
    }
  }, [activityClass]);

  if (activityClass == null) return null;

  const classId = activityClass.id;
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSave) return;

    setApiError(null);
    setSubmitting(true);

    try {
      await onSubmit(classId, { name: trimmedName, type });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('Could not update activity class.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CenteredModal open ariaLabel="Edit activity class" onClose={onClose}>
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-title font-bold text-ink">Edit Activity Class</h2>
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
                  name="editActivityClassType"
                  value="performance"
                  checked={type === 'performance'}
                  onChange={() => setType('performance')}
                />
                Performance
              </label>
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="radio"
                  name="editActivityClassType"
                  value="recovery"
                  checked={type === 'recovery'}
                  onChange={() => setType('recovery')}
                  aria-label="Recovery"
                />
                <span aria-hidden="true">Recovery</span>
              </label>
            </fieldset>

            {apiError != null && (
              <p className="text-body text-danger-fg" role="alert">
                {apiError}
              </p>
            )}

          <button
            type="submit"
            disabled={!canSave}
            className={cn(
              'w-full h-11 rounded-md text-body font-medium transition-colors duration-snap',
              canSave
                ? 'bg-ink text-ink-inverse hover:opacity-90'
                : 'bg-bg-sunken text-ink-faint cursor-not-allowed',
            )}
          >
            Save
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

// ---------------------------------------------------------------------------
// DeleteActivityClassDialog — two-step confirm
// ---------------------------------------------------------------------------

interface DeleteActivityClassDialogProps {
  activityClass: ActivityClass | null;
  step: 1 | 2 | null;
  activitiesToDelete: Activity[];
  errorMessage: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirmStep1: () => void;
  onConfirmStep2: () => void;
}

function DeleteActivityClassDialog({
  activityClass,
  step,
  activitiesToDelete,
  errorMessage,
  submitting,
  onCancel,
  onConfirmStep1,
  onConfirmStep2,
}: DeleteActivityClassDialogProps): React.ReactElement | null {
  if (activityClass == null || step == null) return null;

  return (
    <CenteredModal
      open
      onClose={onCancel}
      ariaLabel="Delete activity class"
    >
      {step === 1 ? (
            <>
              <h2 className="text-title font-bold text-ink mb-2">Delete class?</h2>
              <p className="text-body text-ink-muted mb-5">
                Are you sure you want to delete &ldquo;{activityClass.name}&rdquo;?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 h-11 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmStep1}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-md bg-danger text-body font-medium text-ink-inverse"
                >
                  Delete class
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-title font-bold text-ink mb-2">Delete activities too?</h2>
              <p className="text-body text-ink-muted mb-3">
                These activities will be deleted if you continue:
              </p>
              <ul className="mb-4 list-disc pl-5 text-body text-ink">
                {activitiesToDelete.map((activity) => (
                  <li key={activity.id}>{activity.name}</li>
                ))}
              </ul>
              {errorMessage != null && (
                <p className="text-body text-danger-fg mb-3" role="alert">
                  {errorMessage}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 h-11 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmStep2}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-md bg-danger text-body font-medium text-ink-inverse"
                >
                  Delete anyway
                </button>
              </div>
        </>
      )}
    </CenteredModal>
  );
}

// ---------------------------------------------------------------------------
// EditActivityForm — name, class, type, default volume unit
// ---------------------------------------------------------------------------

interface EditActivityFormProps {
  activity: Activity | null;
  activityClasses: ActivityClass[];
  onClose: () => void;
  onSubmit: (activityId: ID, patch: Partial<NewActivityDraft>) => void;
}

function EditActivityForm({
  activity,
  activityClasses,
  onClose,
  onSubmit,
}: EditActivityFormProps): React.ReactElement | null {
  const [name, setName] = React.useState('');
  const [classId, setClassId] = React.useState<ID>('');
  const [type, setType] = React.useState<ActivityType>('performance');
  const [unit, setUnit] = React.useState<VolumeUnit>('km');

  React.useEffect(() => {
    if (activity != null) {
      setName(activity.name);
      setClassId(activity.activityClassId);
      setType(activity.type);
      setUnit(activity.defaultVolumeUnit ?? 'km');
    }
  }, [activity]);

  if (activity == null) return null;

  const activityId = activity.id;
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && classId !== '';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!canSave) return;

    onSubmit(activityId, {
      name: trimmedName,
      activityClassId: classId,
      type,
      defaultVolumeUnit: unit,
    });
    onClose();
  }

  return (
    <CenteredModal open ariaLabel="Edit activity" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-title font-bold text-ink">Edit Activity</p>
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
            <span className="text-label font-medium text-ink-muted">Activity name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Activity name"
              className="h-11 rounded-md border border-border bg-bg px-3 text-body text-ink"
              autoComplete="off"
            />
          </label>

          <div>
            <p className="mb-2 text-label font-medium text-ink-muted">Activity class</p>
            {activityClasses.length === 0 ? (
              <p className="py-2 text-body text-ink-faint">No activity classes</p>
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
                {activityClasses.map((activityClass) => {
                  const isSelected = classId === activityClass.id;
                  return (
                    <button
                      key={activityClass.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setClassId(activityClass.id)}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                        isSelected ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-body font-medium',
                            isSelected ? 'text-ink' : 'text-ink-muted',
                          )}
                        >
                          {activityClass.name}
                        </span>
                        <span className="block text-caption capitalize text-ink-faint">
                          {activityClass.type}
                        </span>
                      </span>
                      {isSelected ? (
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
                            stroke="#E8ECF1"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
            <legend className="text-label font-medium text-ink-muted mb-1">Type</legend>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="radio"
                name="editActivityType"
                value="performance"
                checked={type === 'performance'}
                aria-checked={type === 'performance'}
                onChange={() => setType('performance')}
              />
              Performance
            </label>
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="radio"
                name="editActivityType"
                value="recovery"
                checked={type === 'recovery'}
                aria-checked={type === 'recovery'}
                onChange={() => setType('recovery')}
                aria-label="Recovery"
              />
              <span aria-hidden="true">Recovery</span>
            </label>
          </fieldset>

          <div>
            <p className="mb-2 text-label font-medium text-ink-muted">Default volume unit</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ACTIVITY_VOLUME_UNIT_OPTIONS.map((option) => {
                const isSelected = unit === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setUnit(option.value)}
                    className={cn(
                      'h-9 rounded-md border text-body font-medium transition-colors duration-snap',
                      isSelected
                        ? 'border-transparent bg-ink text-ink-inverse'
                        : 'border-border bg-bg-sunken text-ink-muted hover:bg-bg-overlay',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSave}
            className={cn(
              'w-full h-11 rounded-md text-body font-medium transition-colors duration-snap',
              canSave
                ? 'bg-ink text-ink-inverse hover:opacity-90'
                : 'bg-bg-sunken text-ink-faint cursor-not-allowed',
            )}
          >
            Save
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export function SettingsScreen({
  engine,
  onEditRules,
  onReview,
  onViewBlock,
  onOpenNewActivity,
  onUnauthenticated,
}: SettingsScreenProps): React.ReactElement {
  const {
    block,
    rules,
    activityClasses,
    activities,
    logs,
    previousBlocks,
    deactivateActivity,
    updateActivity,
    submitNewActivityClass,
    updateActivityClass,
    deleteActivityClass,
  } = engine;

  const queryClient = useQueryClient();
  const [notifications, setNotifications] = React.useState(true);
  const [metricUnits, setMetricUnits] = React.useState(true);
  const [resetState, setResetState] = React.useState<'idle' | 'confirming' | 'done'>('idle');
  const [pendingDeactivateId, setPendingDeactivateId] = React.useState<string | null>(null);
  const [showNewClassForm, setShowNewClassForm] = React.useState(false);
  const [editingClass, setEditingClass] = React.useState<ActivityClass | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ActivityClass | null>(null);
  const [deleteStep, setDeleteStep] = React.useState<1 | 2 | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [editingActivity, setEditingActivity] = React.useState<Activity | null>(null);
  const [showPreviousWeeksModal, setShowPreviousWeeksModal] = React.useState(false);

  const mostRecentPreviousWeek =
    previousBlocks.length > 0 ? previousBlocks[0] : undefined;

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

  const deleteActivities = React.useMemo(() => {
    if (deleteTarget == null) return [];
    return activities.filter((activity) => activity.activityClassId === deleteTarget.id);
  }, [activities, deleteTarget]);

  function resetDeleteDialog(): void {
    setDeleteTarget(null);
    setDeleteStep(null);
    setDeleteError(null);
    setDeleteSubmitting(false);
  }

  async function performDeleteClass(classId: ID): Promise<void> {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteActivityClass(classId);
      resetDeleteDialog();
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Could not delete activity class.');
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleDeleteStep1Confirm(): void {
    if (deleteTarget == null) return;
    if (deleteActivities.length === 0) {
      void performDeleteClass(deleteTarget.id);
      return;
    }
    setDeleteStep(2);
  }

  function handleDeleteStep2Confirm(): void {
    if (deleteTarget == null) return;
    void performDeleteClass(deleteTarget.id);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-2 shrink-0">
        <h1 className="text-title font-bold text-ink">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10">

        {/* ── Weekly rules ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">
            Weekly rules
          </p>
          {hasBlock ? (
            <WeeklyRulesSummaryCard
              block={block}
              rules={rules}
              activityClasses={activityClasses}
              activities={activities}
              showEditRules={showEditRules}
              onEditRules={() => onEditRules?.()}
              onReview={onReview}
            />
          ) : (
            <Card pad="md">
              <p className="text-body text-ink-muted">No active weekly rules</p>
            </Card>
          )}
        </section>

        {/* ── Previous weeks ── */}
        {mostRecentPreviousWeek != null && (
          <section>
            <button
              type="button"
              onClick={() => setShowPreviousWeeksModal(true)}
              className="text-label uppercase font-medium text-ink-muted mb-3 hover:text-ink transition-colors duration-snap"
            >
              Previous weeks
            </button>
            <Card pad="none">
              <button
                type="button"
                onClick={() => onViewBlock?.(mostRecentPreviousWeek.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-snap hover:bg-bg-overlay"
              >
                <span className="min-w-0 flex-1 text-body font-medium text-ink">
                  {formatCalendarWeekRange(
                    mostRecentPreviousWeek.startDate,
                    mostRecentPreviousWeek.endDate ?? mostRecentPreviousWeek.startDate,
                  )}
                </span>
                {mostRecentPreviousWeek.isReviewMilestoneHit ? (
                  <ReviewMilestoneBadge compact />
                ) : null}
              </button>
            </Card>
          </section>
        )}

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
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="text-body font-medium text-ink min-w-0 truncate">
                      {cls.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit ${cls.name}`}
                        onClick={() => setEditingClass(cls)}
                        className="h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${cls.name}`}
                        onClick={() => {
                          setDeleteTarget(cls);
                          setDeleteStep(1);
                          setDeleteError(null);
                        }}
                        className="h-8 px-2.5 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* ── Activities ── */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-label uppercase font-medium text-ink-muted">
              Activities
            </p>
            {onOpenNewActivity != null && (
              <button
                type="button"
                onClick={onOpenNewActivity}
                className="shrink-0 h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
              >
                + New Activity
              </button>
            )}
          </div>
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
                        onEdit={() => setEditingActivity(act)}
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

      <EditActivityClassForm
        activityClass={editingClass}
        onClose={() => setEditingClass(null)}
        onSubmit={updateActivityClass}
      />

      <DeleteActivityClassDialog
        activityClass={deleteTarget}
        step={deleteStep}
        activitiesToDelete={deleteActivities}
        errorMessage={deleteError}
        submitting={deleteSubmitting}
        onCancel={resetDeleteDialog}
        onConfirmStep1={handleDeleteStep1Confirm}
        onConfirmStep2={handleDeleteStep2Confirm}
      />

      <EditActivityForm
        activity={editingActivity}
        activityClasses={activityClasses}
        onClose={() => setEditingActivity(null)}
        onSubmit={updateActivity}
      />

      <PreviousWeeksModal
        open={showPreviousWeeksModal}
        previousBlocks={previousBlocks}
        onClose={() => setShowPreviousWeeksModal(false)}
        onViewBlock={(blockId) => {
          setShowPreviousWeeksModal(false);
          onViewBlock?.(blockId);
        }}
      />
    </div>
  );
}
