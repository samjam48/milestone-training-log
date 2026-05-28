// =============================================================================
// MorningCheckInScreen — Tier 3
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { Slider } from '../ui/Slider';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { MilestoneEngineResult, CheckInDraft } from '../../hooks/useMilestoneEngine';
import type { Score0to10, SafetyState } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onBack: () => void;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Slider state derivation
// ---------------------------------------------------------------------------

function painState(v: number): SafetyState | 'neutral' {
  return v >= 7 ? 'danger' : v >= 4 ? 'caution' : 'safe';
}
function readinessState(v: number): SafetyState | 'neutral' {
  return v >= 7 ? 'safe' : v >= 4 ? 'caution' : 'danger';
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const BackButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <button
    type="button"
    onClick={onPress}
    className="flex items-center gap-1.5 text-body text-ink-muted hover:text-ink transition-colors duration-snap py-1"
    aria-label="Go back"
  >
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    Back
  </button>
);

const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-body-lg font-semibold text-ink mb-3">
    {children}
  </label>
);

const FieldGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card pad="md">
    {children}
  </Card>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const MorningCheckInScreen: React.FC<Props> = ({ engine, onBack, onComplete }) => {
  const { todayDate, submitCheckIn } = engine;

  const [pain,       setPain]       = React.useState<number>(0);
  const [stiffness,  setStiffness]  = React.useState<number>(0);
  const [readiness,  setReadiness]  = React.useState<number>(7);
  const [flareUp,    setFlareUp]    = React.useState<'yes' | 'no'>('no');
  const [bodyPart,   setBodyPart]   = React.useState('');
  const [severity,   setSeverity]   = React.useState<number>(5);
  const [notes,      setNotes]      = React.useState('');
  const [submitted,  setSubmitted]  = React.useState(false);

  const formattedDate = new Date(todayDate + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const draft: CheckInDraft = {
      painLevel:      pain      as Score0to10,
      readinessLevel: readiness as Score0to10,
      stiffnessLevel: stiffness as Score0to10,
      hasFlareUp:     flareUp === 'yes',
      flareUpBodyPart:  flareUp === 'yes' ? bodyPart || undefined : undefined,
      flareUpSeverity:  flareUp === 'yes' ? (severity as Score0to10) : undefined,
      notes: notes || undefined,
    };
    submitCheckIn(draft);
    setSubmitted(true);
    setTimeout(onComplete, 900);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-safe/20">
          <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M5 14l6 6L23 7" stroke="#3DD68C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-title font-semibold text-safe-fg">Check-in logged.</p>
        <p className="text-body text-ink-muted">Your status lights will update now.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <BackButton onPress={onBack} />
        <h1 className="text-title font-bold text-ink mt-3">Morning Check-In</h1>
        <p className="text-caption text-ink-muted mt-0.5">{formattedDate}</p>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 mt-2">
        {/* Pain level */}
        <FieldGroup>
          <FieldLabel>Pain level</FieldLabel>
          <Slider
            value={pain}
            onChange={v => setPain(v)}
            min={0} max={10} step={1}
            leftLabel="None"
            rightLabel="Severe"
            state={painState(pain)}
            valueSuffix="/10"
          />
        </FieldGroup>

        {/* Stiffness */}
        <FieldGroup>
          <FieldLabel>Stiffness</FieldLabel>
          <Slider
            value={stiffness}
            onChange={v => setStiffness(v)}
            min={0} max={10} step={1}
            leftLabel="Loose"
            rightLabel="Very stiff"
            state={painState(stiffness)}
            valueSuffix="/10"
          />
        </FieldGroup>

        {/* Readiness */}
        <FieldGroup>
          <FieldLabel>Readiness to train</FieldLabel>
          <Slider
            value={readiness}
            onChange={v => setReadiness(v)}
            min={0} max={10} step={1}
            leftLabel="Exhausted"
            rightLabel="Fresh"
            state={readinessState(readiness)}
            valueSuffix="/10"
          />
        </FieldGroup>

        {/* Flare-up toggle */}
        <FieldGroup>
          <FieldLabel>Flare-up today?</FieldLabel>
          <SegmentedControl
            value={flareUp}
            onChange={v => setFlareUp(v as 'yes' | 'no')}
            options={[
              { value: 'no',  label: 'No',  tone: 'safe' },
              { value: 'yes', label: 'Yes', tone: 'danger' },
            ]}
            ariaLabel="Flare-up today"
          />
          {flareUp === 'yes' && (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-body font-medium text-ink mb-2" htmlFor="body-part">
                  Body part affected
                </label>
                <input
                  id="body-part"
                  type="text"
                  value={bodyPart}
                  onChange={e => setBodyPart(e.target.value)}
                  placeholder="e.g. Left heel"
                  className={cn(
                    'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                    'text-body text-ink placeholder:text-ink-faint',
                    'focus:outline-none focus:border-border-strong',
                  )}
                />
              </div>
              <div>
                <p className="text-body font-medium text-ink mb-2">Severity</p>
                <Slider
                  value={severity}
                  onChange={v => setSeverity(v)}
                  min={1} max={10} step={1}
                  leftLabel="Mild"
                  rightLabel="Severe"
                  state={painState(severity)}
                  valueSuffix="/10"
                />
              </div>
            </div>
          )}
        </FieldGroup>

        {/* Notes */}
        <Card pad="md">
          <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything you want to remember…"
            rows={3}
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5 resize-none',
              'text-body text-ink placeholder:text-ink-faint',
              'focus:outline-none focus:border-border-strong',
            )}
          />
        </Card>

        {/* Submit */}
        <button
          type="submit"
          className="h-12 w-full rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:bg-ink/80"
        >
          Save check-in
        </button>
      </div>
    </form>
  );
};
