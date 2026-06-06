// =============================================================================
// LogIncidentScreen — Tier 3
// -----------------------------------------------------------------------------
// Captures a sudden flare-up or injury flare independently of the morning
// check-in. The user can log it any time, not just during check-in.
// Calls engine.submitIncident() which appends to the FlareUpIncident list
// and causes the heatmap + daily score to show 'danger' for today.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { buildBodyPartSuggestions } from '../../lib/bodyPartSuggestions';
import { BackButton } from '../ui/BackButton';
import { Card } from '../ui/Card';
import { Slider } from '../ui/Slider';
import { DelayedTaxAttributionSection } from '../composites/DelayedTaxAttributionSection';
import type { MilestoneEngineResult, IncidentDraft } from '../../hooks/useMilestoneEngine';
import type { FlareUpIncident, Score0to10 } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onBack: () => void;
  onComplete: () => void;
}

/** @deprecated Use buildBodyPartSuggestions with check-ins from the engine. */
export function buildIncidentBodyPartSuggestions(incidents: FlareUpIncident[]): string[] {
  return buildBodyPartSuggestions(incidents, []);
}

function severityState(v: number) {
  return v >= 7 ? 'danger' : v >= 4 ? 'caution' : 'safe';
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const LogIncidentScreen: React.FC<Props> = ({ engine, onBack, onComplete }) => {
  const {
    todayDate,
    delayedTax,
    delayedTaxError,
    activityClasses,
    incidents,
    checkIns,
    submitIncident,
  } = engine;

  const [bodyPart,      setBodyPart]      = React.useState('');
  const [severity,      setSeverity]      = React.useState<number>(5);
  const [causeClassId,  setCauseClassId]  = React.useState<string>('');
  const [notes,         setNotes]         = React.useState('');
  const [submitted,     setSubmitted]     = React.useState(false);

  const bodyPartSuggestions = React.useMemo(
    () => buildBodyPartSuggestions(incidents, checkIns),
    [incidents, checkIns],
  );

  const canSubmit = bodyPart.trim().length > 0;

  const formattedDate = new Date(todayDate + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const draft: IncidentDraft = {
      bodyPart: bodyPart.trim(),
      severity: severity as Score0to10,
      activityClassId: causeClassId || undefined,
      notes: notes || undefined,
    };
    submitIncident(draft);
    setSubmitted(true);
  }

  if (submitted) return (
    <div className="flex flex-col items-center gap-4 px-4 pb-8 pt-8 text-center overflow-y-auto">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/20">
        <svg width={28} height={28} viewBox="0 0 28 28" fill="none"><path d="M14 5v10M14 21v1" stroke="#FF8780" strokeWidth={2.5} strokeLinecap="round"/></svg>
      </span>
      <p className="text-title font-semibold text-danger-fg">Incident recorded.</p>
      <p className="text-body text-ink-muted">Rest up. The heatmap and dashboard reflect today's status.</p>
      <DelayedTaxAttributionSection
        delayedTax={delayedTax}
        delayedTaxError={delayedTaxError}
        activityClasses={activityClasses}
      />
      <button
        type="button"
        onClick={onComplete}
        className="mt-2 h-12 w-full max-w-md rounded-md bg-danger text-body-lg font-semibold text-ink-inverse active:brightness-90"
      >
        Done
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pb-2 shrink-0">
        <BackButton onPress={onBack} />
        <div className="mt-3 flex items-start gap-2">
          <div>
            <h1 className="text-title font-bold text-danger-fg">Log Incident</h1>
            <p className="text-caption text-ink-muted mt-0.5">{formattedDate}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-safe-bottom mt-2">
        {/* Body part */}
        <Card intent="danger" pad="md">
          <p className="text-body-lg font-semibold text-ink mb-3">What's flared up?</p>
          {bodyPartSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {bodyPartSuggestions.map(part => (
                <button
                  key={part}
                  type="button"
                  onClick={() => setBodyPart(part)}
                  className={cn(
                    'h-8 px-3 rounded-pill text-body font-medium transition-colors duration-snap border',
                    'bg-bg-sunken text-ink-muted border-border hover:border-border-strong',
                  )}
                >
                  {part}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={bodyPart}
            onChange={e => setBodyPart(e.target.value)}
            placeholder="e.g. Right toe"
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-border-strong',
            )}
          />
        </Card>

        {/* Severity */}
        <Card pad="md">
          <p className="text-body-lg font-semibold text-ink mb-3">Severity</p>
          <Slider value={severity} onChange={setSeverity} min={1} max={10} step={1}
            leftLabel="Mild twinge" rightLabel="Severe pain"
            state={severityState(severity)} valueSuffix="/10" />
        </Card>

        {/* Likely cause */}
        <Card pad="md">
          <p className="text-body-lg font-semibold text-ink mb-3">What likely caused it? <span className="text-ink-faint font-normal">(optional)</span></p>
          <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
            <button type="button" onClick={() => setCauseClassId('')}
              className={cn('flex items-center justify-between px-3 py-2.5 text-left transition-colors duration-snap',
                causeClassId === '' ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay')}>
              <span className={cn('text-body font-medium', causeClassId === '' ? 'text-ink' : 'text-ink-muted')}>Not sure / unrelated</span>
              {causeClassId === '' && <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            {activityClasses.filter(c => c.type === 'performance').map(cls => (
              <button key={cls.id} type="button" onClick={() => setCauseClassId(cls.id)}
                className={cn('flex items-center justify-between px-3 py-2.5 text-left transition-colors duration-snap',
                  causeClassId === cls.id ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay')}>
                <span className={cn('text-body font-medium', causeClassId === cls.id ? 'text-ink' : 'text-ink-muted')}>{cls.name}</span>
                {causeClassId === cls.id && <svg width={16} height={16} viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card pad="md">
          <label className="block text-body font-medium text-ink mb-2" htmlFor="inc-notes">Notes (optional)</label>
          <textarea id="inc-notes" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="What were you doing? Any warning signs?" rows={3}
            className={cn('w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5 resize-none',
              'text-body text-ink placeholder:text-ink-faint focus:outline-none focus:border-border-strong')} />
        </Card>

        <button type="submit" disabled={!canSubmit}
          className={cn('h-12 w-full rounded-md text-body-lg font-semibold transition-colors duration-snap',
            'bg-danger text-ink-inverse active:brightness-90',
            !canSubmit && 'opacity-40 cursor-not-allowed')}>
          Record incident
        </button>
      </div>
    </form>
  );
};
