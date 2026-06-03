// =============================================================================
// InlineLogSheet — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Compact bottom-sheet quick log. Pre-selects the activity passed in.
// Opened from Dashboard suggestion "Log" buttons. Calls engine.submitLog.
//
// React Native note: replace the scrim + absolute positioning with a Modal
// (or @gorhom/bottom-sheet) — the rest of the component is portable.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Slider } from '../ui/Slider';
import { SegmentedControl } from '../ui/SegmentedControl';
import { RuleViolationBanner } from '../composites/RuleViolationBanner';
import type { MilestoneEngineResult, LogDraft } from '../../hooks/useMilestoneEngine';
import type { Activity, VolumeUnit, PostActivityFeel, RPE } from '../../types';

interface Props {
  open:     boolean;
  onClose:  () => void;
  activity: Activity | null;
  engine:   MilestoneEngineResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultVol(unit: VolumeUnit | undefined): number {
  if (unit === 'km' || unit === 'mi') return 1;
  if (unit === 'minutes')             return 20;
  if (unit === 'sets')                return 3;
  return 1;
}

function volStep(unit: VolumeUnit | undefined): number {
  if (unit === 'km' || unit === 'mi') return 0.5;
  if (unit === 'minutes')             return 5;
  return 1;
}

// ---------------------------------------------------------------------------
// NumStepper
// ---------------------------------------------------------------------------

interface NumStepperProps {
  value:    number;
  onChange: (v: number) => void;
  step?:    number;
  min?:     number;
  max?:     number;
}

const NumStepper: React.FC<NumStepperProps> = ({ value, onChange, step = 1, min = 0, max = 9999 }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
      disabled={value <= min}
      aria-label="Decrease"
      className="h-9 w-9 flex items-center justify-center rounded-md bg-bg-sunken border border-border text-body-lg font-medium text-ink-muted hover:text-ink hover:bg-bg-overlay disabled:opacity-30 transition-colors duration-snap"
    >–</button>
    <span className="flex-1 text-center font-metric text-body-lg text-ink tabular-nums">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(2))))}
      disabled={value >= max}
      aria-label="Increase"
      className="h-9 w-9 flex items-center justify-center rounded-md bg-bg-sunken border border-border text-body-lg font-medium text-ink-muted hover:text-ink hover:bg-bg-overlay disabled:opacity-30 transition-colors duration-snap"
    >+</button>
  </div>
);

// ---------------------------------------------------------------------------
// Feel options
// ---------------------------------------------------------------------------

const FEEL_OPTS: Array<{ value: PostActivityFeel; label: string; tone: 'safe' | 'caution' | 'danger' }> = [
  { value: 'fine',            label: 'Fine',       tone: 'safe'    },
  { value: 'mild_discomfort', label: 'Discomfort', tone: 'caution' },
  { value: 'bad',             label: 'Bad',        tone: 'danger'  },
];

// ---------------------------------------------------------------------------
// InlineLogSheet
// ---------------------------------------------------------------------------

export const InlineLogSheet: React.FC<Props> = ({ open, onClose, activity, engine }) => {
  const { submitLog, checkViolations, todayDate } = engine;

  const unit    = activity?.defaultVolumeUnit;
  const vstep   = volStep(unit);
  const vinit   = defaultVol(unit);

  const [duration, setDuration] = React.useState(20);
  const [volume,   setVolume]   = React.useState(vinit);
  const [rpe,      setRpe]      = React.useState(5);
  const [feel,     setFeel]     = React.useState<PostActivityFeel>('fine');
  const [override, setOverride] = React.useState(false);

  // Reset when sheet opens or activity changes
  React.useEffect(() => {
    if (open && activity) {
      setDuration(20);
      setVolume(defaultVol(activity.defaultVolumeUnit));
      setRpe(5);
      setFeel('fine');
      setOverride(false);
    }
  }, [open, activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !activity) return null;

  const violations = checkViolations(activity.id, volume, rpe);
  const hasBlock   = violations.some(v => v.severity === 'danger');
  const canLog     = override || !hasBlock;
  const rpeState   = rpe <= 3 ? 'safe' : rpe <= 6 ? 'caution' : 'danger';

  function handleLog() {
    if (!canLog) return;
    const draft: LogDraft = {
      activityId:          activity!.id,
      durationMinutes:     duration,
      volumeValue:         volume,
      volumeUnit:          unit,
      rpe:                 rpe as RPE,
      postActivityFeel:    feel,
      ruleViolationsAtLog: violations.length > 0 ? violations : undefined,
    };
    submitLog(draft);
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

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border"
        role="dialog"
        aria-modal="true"
        aria-label={`Quick log — ${activity.name}`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="px-4 pb-8 pt-2 flex flex-col gap-4">

          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-title font-bold text-ink">{activity.name}</h2>
              <p className="text-caption text-ink-muted mt-0.5">Quick log · {todayDate}</p>
            </div>
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Duration + Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-caption text-ink-muted mb-2">Duration (min)</p>
              <NumStepper value={duration} onChange={setDuration} step={5} min={5} max={180} />
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-2">Volume ({unit ?? 'units'})</p>
              <NumStepper value={volume} onChange={setVolume} step={vstep} min={vstep} max={200} />
            </div>
          </div>

          {/* RPE */}
          <div>
            <p className="text-caption text-ink-muted mb-2">Effort (RPE)</p>
            <Slider
              value={rpe}
              onChange={setRpe}
              min={1}
              max={10}
              leftLabel="Easy"
              rightLabel="Max"
              state={rpeState}
            />
          </div>

          {/* Feel */}
          <div>
            <p className="text-caption text-ink-muted mb-2">How did it feel?</p>
            <SegmentedControl
              value={feel}
              onChange={v => setFeel(v as PostActivityFeel)}
              options={FEEL_OPTS}
              ariaLabel="Post-activity feel"
            />
          </div>

          {/* Violations */}
          {violations.length > 0 && !override && (
            <RuleViolationBanner
              violations={violations}
              onOverride={hasBlock ? () => setOverride(true) : undefined}
              onDismiss={hasBlock ? onClose : undefined}
              overrideLabel="Log anyway"
            />
          )}

          {/* Submit */}
          <button
            type="button" onClick={handleLog} disabled={!canLog}
            className={cn(
              'w-full h-12 rounded-md text-body-lg font-semibold transition-colors duration-snap',
              canLog
                ? 'bg-ink text-ink-inverse active:opacity-80'
                : 'bg-ink/20 text-ink-faint cursor-not-allowed',
            )}
          >
            Log session
          </button>

        </div>
      </div>
    </>
  );
};
