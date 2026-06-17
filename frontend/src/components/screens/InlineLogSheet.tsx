import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { Slider } from '../ui/Slider';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl';
import { RuleViolationBanner } from '../composites/RuleViolationBanner';
import type { LogDraft, MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { ApiError } from '../../lib/api/client';
import type {
  Activity,
  PostActivityFeel,
  RPE,
  RuleViolationSnapshot,
  SafetyState,
  VolumeUnit,
} from '../../types';

interface InlineLogSheetProps {
  open: boolean;
  onClose: () => void;
  activity: Activity | null;
  engine: MilestoneEngineResult;
}

const DEFAULT_DURATION = 20;
const DEFAULT_RPE: RPE = 5;

const FEEL_OPTIONS: SegmentedOption<PostActivityFeel>[] = [
  { value: 'fine', label: 'Fine', tone: 'safe' as const },
  { value: 'mild_discomfort', label: 'Discomfort', tone: 'caution' as const },
  { value: 'bad', label: 'Bad', tone: 'danger' as const },
];

function rpeState(value: number): SafetyState | 'neutral' {
  if (value >= 8) return 'danger';
  if (value >= 5) return 'caution';
  return 'safe';
}

function hasDangerViolation(violations: RuleViolationSnapshot[]): boolean {
  return violations.some((violation) => violation.severity === 'danger');
}

function clampPositive(value: number): number {
  return Math.max(1, value);
}

function defaultVolume(unit: VolumeUnit | undefined): number {
  if (unit === 'km' || unit === 'mi') return 1;
  if (unit === 'minutes') return 20;
  if (unit === 'sets') return 3;
  return 1;
}

function volumeStep(unit: VolumeUnit | undefined): number {
  if (unit === 'km' || unit === 'mi') return 0.5;
  if (unit === 'minutes') return 5;
  return 1;
}

function effectiveVolumeValue(
  volumeUnit: VolumeUnit | undefined,
  duration: number,
  volume: number,
): number {
  return volumeUnit === 'minutes' ? duration : volume;
}

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  onChange: (next: number) => void;
  step?: number;
  primaryControls?: boolean;
}

function Stepper({
  label,
  value,
  unit,
  onChange,
  step = 5,
  primaryControls = false,
}: StepperProps): React.ReactElement {
  const decreaseLabel = primaryControls ? 'Decrease' : `Decrease ${label.toLowerCase()}`;
  const increaseLabel = primaryControls ? 'Increase' : `Increase ${label.toLowerCase()}`;

  return (
    <div>
      <p className="mb-2 text-body font-medium text-ink">{label}</p>
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button
          type="button"
          aria-label={decreaseLabel}
          onClick={() => onChange(clampPositive(value - step))}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-bg-sunken text-title font-semibold text-ink-muted transition-colors duration-snap hover:bg-bg-overlay hover:text-ink"
        >
          -
        </button>
        <div className="rounded-md border border-border bg-bg-sunken px-3 py-2 text-center">
          <span className="font-metric text-title font-semibold text-ink tabular-nums">
            {value}
          </span>
          <span className="ml-1 text-body text-ink-muted">{unit}</span>
        </div>
        <button
          type="button"
          aria-label={increaseLabel}
          onClick={() => onChange(value + step)}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-bg-sunken text-title font-semibold text-ink-muted transition-colors duration-snap hover:bg-bg-overlay hover:text-ink"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function InlineLogSheet({
  open,
  onClose,
  activity,
  engine,
}: InlineLogSheetProps): React.ReactElement | null {
  const [duration, setDuration] = React.useState(DEFAULT_DURATION);
  const [volume, setVolume] = React.useState(() => defaultVolume(undefined));
  const [rpe, setRpe] = React.useState<RPE>(DEFAULT_RPE);
  const [feel, setFeel] = React.useState<PostActivityFeel>('fine');
  const [dangerOverridden, setDangerOverridden] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDuration(DEFAULT_DURATION);
      setVolume(defaultVolume(activity?.defaultVolumeUnit));
      setRpe(DEFAULT_RPE);
      setFeel('fine');
      setDangerOverridden(false);
      setSaveError(null);
      setIsSaving(false);
    }
  }, [open, activity?.id, activity?.defaultVolumeUnit]);

  const effectiveVolume = React.useMemo(
    () => effectiveVolumeValue(activity?.defaultVolumeUnit, duration, volume),
    [activity?.defaultVolumeUnit, duration, volume],
  );

  const violations = React.useMemo(() => {
    if (!open || activity == null) return [];
    return engine.checkViolations(
      activity.id,
      effectiveVolume,
      rpe,
      duration > 0 ? duration : undefined,
      activity.defaultVolumeUnit,
    );
  }, [activity, duration, effectiveVolume, engine, open, rpe]);

  React.useEffect(() => {
    setDangerOverridden(false);
  }, [activity?.id, effectiveVolume, rpe]);

  if (!open || activity == null) return null;

  const volumeUnit = activity.defaultVolumeUnit;
  const volumeStepValue = volumeStep(volumeUnit);
  const showVolumeStepper = volumeUnit !== 'minutes';

  const dangerBlocked = hasDangerViolation(violations) && !dangerOverridden;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (activity == null || dangerBlocked || isSaving) return;

    const draft: LogDraft = {
      activityId: activity.id,
      loggedDate: engine.todayDate,
      durationMinutes: duration,
      volumeValue: effectiveVolume,
      volumeUnit: activity.defaultVolumeUnit,
      rpe,
      postActivityFeel: feel,
      ruleViolationsAtLog: violations.length > 0 ? violations : undefined,
    };

    setSaveError(null);
    setIsSaving(true);
    try {
      await engine.submitLog(draft);
      onClose();
    } catch (error) {
      setSaveError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not save session.',
      );
    } finally {
      setIsSaving(false);
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
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Quick log \u2014 ${activity.name}`}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-[440px] overflow-y-auto rounded-t-2xl border-t border-border bg-bg-raised shadow-card pb-safe-bottom"
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8 pt-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-label uppercase tracking-wider text-ink-muted">
                Quick log
              </p>
              <h2 className="mt-1 text-title font-bold text-ink">{activity.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors duration-snap hover:bg-bg-overlay hover:text-ink"
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

          <Card pad="md">
            <div className="flex flex-col gap-4">
              <Stepper
                label="Duration"
                value={duration}
                unit="min"
                onChange={setDuration}
                primaryControls
              />
              {showVolumeStepper && (
                <Stepper
                  label="Volume"
                  value={volume}
                  unit={volumeUnit ?? 'units'}
                  onChange={setVolume}
                  step={volumeStepValue}
                />
              )}
            </div>
          </Card>

          <Card pad="md">
            <p className="mb-3 text-body-lg font-semibold text-ink">Effort</p>
            <Slider
              value={rpe}
              onChange={(next) => setRpe(next as RPE)}
              min={1}
              max={10}
              step={1}
              leftLabel="Easy"
              rightLabel="Max"
              state={rpeState(rpe)}
              valueSuffix="/10"
            />
          </Card>

          <Card pad="md">
            <p className="mb-3 text-body-lg font-semibold text-ink">How did it go?</p>
            <SegmentedControl
              value={feel}
              onChange={(next) => setFeel(next)}
              options={FEEL_OPTIONS}
              ariaLabel="Post-activity feel"
            />
          </Card>

          {violations.length > 0 && (
            <RuleViolationBanner
              violations={violations}
              onOverride={() => setDangerOverridden(true)}
              overrideLabel="Log anyway"
            />
          )}

          {saveError != null && (
            <p role="alert" className="text-body text-danger-fg">
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={dangerBlocked || isSaving}
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-md text-body-lg font-semibold transition-colors duration-snap',
              dangerBlocked && !isSaving
                ? 'cursor-not-allowed bg-ink/20 text-ink-faint'
                : 'bg-ink text-ink-inverse active:opacity-80',
              isSaving && 'cursor-wait opacity-80',
            )}
          >
            {isSaving ? (
              <>
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-inverse/30 border-t-ink-inverse"
                  aria-hidden="true"
                />
                <span>Logging…</span>
              </>
            ) : (
              'Log session'
            )}
          </button>
        </form>
      </section>
    </>
  );
}
