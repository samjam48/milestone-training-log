// =============================================================================
// LogActivityScreen — Tier 3
// -----------------------------------------------------------------------------
// The primary log form. Key behaviour:
//   • Activity picker grouped by class (radio-style rows)
//   • Duration + volume number fields (unit auto-populated from activity)
//   • RPE slider — state tint safe → caution → danger as effort rises
//   • Post-activity feel — SegmentedControl (Fine / Discomfort / Bad)
//   • Live rule-violation banner — recomputes on every input change
//   • Submit without blocking: violations are attached to the log draft and
//     the button label changes to "Log anyway" — users always own the call
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { BackButton } from '../ui/BackButton';
import { Card } from '../ui/Card';
import { Slider } from '../ui/Slider';
import { SegmentedControl } from '../ui/SegmentedControl';
import { RuleViolationBanner } from '../composites/RuleViolationBanner';
import { DatePickerModal, formatLogDateLabel } from '../ui/DatePickerModal';
import type { MilestoneEngineResult, LogDraft, LogPatch } from '../../hooks/useMilestoneEngine';
import type { Activity, ActivityClass, ISODate, RPE, PostActivityFeel, SafetyState } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  /** Pre-selected activity (e.g. tapped from SuggestedActivityCard). */
  initialActivityId?: string;
  /** When set, form edits an existing log instead of creating one. */
  logId?: string;
  onBack: () => void;
  onComplete: () => void;
  onCreateActivity?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpeState(v: number): SafetyState | 'neutral' {
  if (v === 0) return 'neutral';
  return v >= 8 ? 'danger' : v >= 5 ? 'caution' : 'safe';
}

const FEEL_OPTIONS = [
  { value: 'fine',             label: 'Fine',       tone: 'safe'    as const },
  { value: 'mild_discomfort',  label: 'Discomfort', tone: 'caution' as const },
  { value: 'bad',              label: 'Bad',        tone: 'danger'  as const },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-body-lg font-semibold text-ink mb-3">{children}</p>
);

const NumberField: React.FC<{
  value: number; onChange: (v: number) => void;
  unit: string; min?: number; placeholder?: string; step?: string | number;
}> = ({ value, onChange, unit, min = 0, placeholder, step }) => (
  <div className="flex items-center gap-2">
    <input
      type="number" min={min} step={step}
      value={value === 0 ? '' : value}
      placeholder={placeholder ?? '0'}
      onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))}
      className={cn('flex-1 rounded-md bg-bg-sunken border border-border px-3 py-2.5',
        'text-body-lg font-metric text-ink placeholder:text-ink-faint',
        'focus:outline-none focus:border-border-strong')}
    />
    <span className="text-body text-ink-muted w-10 shrink-0">{unit}</span>
  </div>
);

// Group activities by class for the picker
interface Group { cls: ActivityClass; acts: Activity[] }
function groupActivities(classes: ActivityClass[], activities: Activity[]): Group[] {
  return classes.map(cls => ({
    cls,
    acts: activities.filter(a => a.activityClassId === cls.id && a.isActive),
  })).filter(g => g.acts.length > 0);
}

function resolveInitialActivityId(
  initialActivityId: string | undefined,
  activities: Activity[],
): string {
  if (initialActivityId == null || initialActivityId === '') return '';
  const act = activities.find(a => a.id === initialActivityId);
  if (act == null || !act.isActive) return '';
  return initialActivityId;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function buildLogPatch(
  selectedId: string,
  loggedDate: ISODate,
  duration: number,
  volume: number,
  selAct: Activity | undefined,
  rpe: number,
  feel: PostActivityFeel,
  notes: string,
  violations: ReturnType<MilestoneEngineResult['checkViolations']>,
): LogPatch {
  return {
    activityId: selectedId,
    loggedDate,
    durationMinutes: duration,
    volumeValue: volume,
    volumeUnit: selAct?.defaultVolumeUnit,
    rpe: rpe > 0 ? rpe as RPE : undefined,
    postActivityFeel: feel,
    notes: notes || undefined,
    ruleViolationsAtLog: violations.length > 0 ? violations : undefined,
  };
}

export const LogActivityScreen: React.FC<Props> = ({
  engine, initialActivityId, logId, onBack, onComplete, onCreateActivity,
}) => {
  const {
    todayDate,
    activityClasses,
    activities,
    logs,
    checkViolations,
    submitLog,
    updateLog,
  } = engine;

  const editingLog = logId != null ? logs.find(l => l.id === logId) : undefined;
  const isEditMode = editingLog != null;

  const [selectedId,  setSelectedId]  = React.useState<string>(() => {
    if (editingLog != null) return editingLog.activityId;
    return resolveInitialActivityId(initialActivityId, activities);
  });
  const [loggedDate,  setLoggedDate]  = React.useState<ISODate>(
    () => editingLog?.loggedDate ?? todayDate,
  );
  const [duration,    setDuration]    = React.useState(
    () => editingLog?.durationMinutes ?? 0,
  );
  const [volume,      setVolume]      = React.useState(
    () => editingLog?.volumeValue ?? 0,
  );
  const [rpe,         setRpe]         = React.useState<number>(
    () => editingLog?.rpe ?? 5,
  );
  const [feel,        setFeel]        = React.useState<PostActivityFeel>(
    () => editingLog?.postActivityFeel ?? 'fine',
  );
  const [notes,       setNotes]       = React.useState(
    () => editingLog?.notes ?? '',
  );
  const [submitted,   setSubmitted]   = React.useState(false);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);

  const groups  = React.useMemo(() => groupActivities(activityClasses, activities), [activityClasses, activities]);
  const hasActiveActivities = groups.length > 0;
  const selAct  = activities.find(a => a.id === selectedId);

  // Live violation check — updates on every relevant input change
  const violations = React.useMemo(() => {
    if (!selectedId || volume <= 0) return [];
    return checkViolations(selectedId, volume, rpe > 0 ? rpe : 5);
  }, [selectedId, volume, rpe, checkViolations]);

  const canSubmit = selectedId !== '' && duration > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (isEditMode && logId != null) {
      updateLog(logId, buildLogPatch(
        selectedId, loggedDate, duration, volume, selAct, rpe, feel, notes, violations,
      ));
    } else {
      const draft: LogDraft = {
        activityId: selectedId,
        loggedDate,
        durationMinutes: duration,
        volumeValue: volume,
        volumeUnit: selAct?.defaultVolumeUnit,
        rpe: rpe > 0 ? rpe as RPE : undefined,
        postActivityFeel: feel,
        notes: notes || undefined,
        ruleViolationsAtLog: violations.length > 0 ? violations : undefined,
      };
      submitLog(draft);
    }
    setSubmitted(true);
    setTimeout(onComplete, 800);
  }

  if (submitted) return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ minHeight: '60vh' }}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-safe/20">
        <svg width={28} height={28} viewBox="0 0 28 28" fill="none"><path d="M5 14l6 6L23 7" stroke="#3DD68C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
      <p className="text-title font-semibold text-safe-fg">
        {isEditMode ? 'Session updated.' : 'Session logged.'}
      </p>
      <p className="text-body text-ink-muted">Your dashboard has been updated.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pb-2 shrink-0">
        <BackButton onPress={onBack} />
        <h1 className="text-title font-bold text-ink mt-3">
          {isEditMode ? 'Edit Activity' : 'Log Activity'}
        </h1>
      </div>

      <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 mt-2">
        {!hasActiveActivities ? (
          <div
            data-testid="log-activity-empty-state"
            className="flex flex-col items-center justify-center gap-4 text-center mt-8 px-2"
          >
            <p className="text-title font-semibold text-ink">No activities yet</p>
            <button
              type="button"
              onClick={onCreateActivity}
              className="h-11 rounded-md bg-ink px-6 text-body font-semibold text-ink-inverse transition-colors duration-snap active:bg-ink/80"
            >
              Create activity
            </button>
          </div>
        ) : (
          <>
        {/* Activity picker */}
        <Card pad="md">
          <FieldLabel>What did you do?</FieldLabel>
          <div className="flex flex-col gap-3">
            {groups.map(({ cls, acts }) => (
              <div key={cls.id}>
                <p className="text-label uppercase font-medium text-ink-muted mb-1.5">{cls.name}</p>
                <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
                  {acts.map(act => (
                    <button key={act.id} type="button" onClick={() => setSelectedId(act.id)}
                      className={cn('flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                        selectedId === act.id ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay')}>
                      <span className={cn('text-body font-medium', selectedId === act.id ? 'text-ink' : 'text-ink-muted')}>{act.name}</span>
                      {selectedId === act.id && (
                        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className="text-ink shrink-0">
                          <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Session details — only show after activity selected */}
        {selectedId && (
          <>
            <Card pad="md">
              <FieldLabel>Date</FieldLabel>
              <button
                type="button"
                data-testid="log-date-field"
                onClick={() => setDatePickerOpen(true)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border border-border bg-bg-sunken',
                  'px-3 py-2.5 text-left transition-colors duration-snap hover:bg-bg-overlay',
                )}
              >
                <span className="text-body font-medium text-ink">
                  {formatLogDateLabel(loggedDate, todayDate)}
                </span>
                <span className="text-caption text-ink-muted">Change</span>
              </button>
            </Card>

            <Card pad="md">
              <FieldLabel>Session details</FieldLabel>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-body font-medium text-ink mb-2">Duration</p>
                  <NumberField value={duration} onChange={setDuration} unit="min" min={1} placeholder="20" />
                </div>
                {selAct?.defaultVolumeUnit && (
                  <div>
                    <p className="text-body font-medium text-ink mb-2">Volume</p>
                    <NumberField value={volume} onChange={setVolume} unit={selAct.defaultVolumeUnit} placeholder="0" step="any" />
                  </div>
                )}
              </div>
            </Card>

            <Card pad="md">
              <FieldLabel>Effort (RPE)</FieldLabel>
              <Slider value={rpe} onChange={setRpe} min={1} max={10} step={1}
                leftLabel="Easy" rightLabel="Max" state={rpeState(rpe)} valueSuffix="/10" />
            </Card>

            <Card pad="md">
              <FieldLabel>How did it go?</FieldLabel>
              <SegmentedControl value={feel} onChange={v => setFeel(v as PostActivityFeel)} options={FEEL_OPTIONS} ariaLabel="Post-activity feel" />
            </Card>

            {/* Live violation banner */}
            {violations.length > 0 && (
              <RuleViolationBanner violations={violations} />
            )}

            <Card pad="md">
              <label className="block text-body font-medium text-ink mb-2" htmlFor="log-notes">Notes (optional)</label>
              <textarea id="log-notes" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Anything worth noting…" rows={3}
                className={cn('w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5 resize-none',
                  'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-border-strong')} />
            </Card>
          </>
        )}
          </>
        )}
      </div>

      {hasActiveActivities && (
      <div className="shrink-0 border-t border-border bg-bg px-4 py-3 pb-safe-bottom">
        <button type="submit" disabled={!canSubmit}
          className={cn('h-12 w-full rounded-md text-body-lg font-semibold transition-colors duration-snap',
            violations.length > 0
              ? 'bg-caution text-ink-inverse active:brightness-90'
              : 'bg-ink text-ink-inverse active:opacity-80',
            !canSubmit && 'opacity-40 cursor-not-allowed')}>
          {isEditMode
            ? (violations.length > 0 ? 'Save anyway' : 'Save changes')
            : (violations.length > 0 ? 'Log anyway' : 'Log session')}
        </button>
      </div>
      )}

      <DatePickerModal
        open={datePickerOpen}
        value={loggedDate}
        maxDate={todayDate}
        onClose={() => setDatePickerOpen(false)}
        onChange={setLoggedDate}
      />
    </form>
  );
};
