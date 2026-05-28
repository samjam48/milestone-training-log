// =============================================================================
// SuggestedActivityCard — "what's safe to do today?"
// -----------------------------------------------------------------------------
// Dashboard card that translates the rules engine's output into a short list
// of suggestions, grouped by safety state:
//
//   safe    → "Do this today" — green StatusDot row, primary CTA
//   caution → "Proceed lightly" — amber row, secondary CTA
//   danger  → "Rest these" — red row, no CTA (informational)
//
// This component is *purely presentational*. It does not look at logs, rules,
// or check-ins itself — the parent (the dashboard, ultimately backed by Tier
// 4.2's rules-engine hook) computes `Suggestion[]` and hands it in. Putting
// the engine inside this component would couple the UI to a specific scoring
// implementation; isolating it here means we can swap in a smarter engine
// (correlation analysis, ML) without touching the card.
//
// The shape `Suggestion` is exported so the engine has a contract to target.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';
import type { ID, ISODate, SafetyState } from '../../types';

export interface Suggestion {
  /** Activity id the suggestion is about. */
  id: ID;
  /** Display name, e.g. "Walking" or "Calf raises". */
  label: string;
  /** Engine-computed state. */
  state: SafetyState;
  /** One-line rationale. The engine owns the wording. */
  reason: string;
  /** Optional next-safe-date for caution/danger rows. */
  nextSafeDate?: ISODate;
  /** Optional last-done date for context. */
  lastDoneDate?: ISODate;
}

export interface SuggestedActivityCardProps {
  /** Pre-grouped or flat list — we'll group internally either way. */
  suggestions: Suggestion[];
  /** Tap handler — fired when the user picks an activity to log. */
  onPick?: (s: Suggestion) => void;
  /** "Log {label}" CTA label override. */
  ctaLabel?: (s: Suggestion) => string;
  /** Optional title override. */
  title?: string;
  /** Optional date string for the "as of" line. Defaults to "Today". */
  asOf?: string;
  className?: string;
}

// -----------------------------------------------------------------------------
// Grouping
// -----------------------------------------------------------------------------

const ORDER: SafetyState[] = ['safe', 'caution', 'danger'];

const GROUP_TITLES: Record<SafetyState, string> = {
  safe:    'Do these today',
  caution: 'Proceed lightly',
  danger:  'Rest these',
};

const GROUP_SUBS: Record<SafetyState, string> = {
  safe:    'Within your active rules and recent load.',
  caution: 'You\u2019re close to a threshold — keep it short.',
  danger:  'A rule or recent flare-up rules these out.',
};

function group(suggestions: Suggestion[]): Record<SafetyState, Suggestion[]> {
  const out: Record<SafetyState, Suggestion[]> = {
    safe: [],
    caution: [],
    danger: [],
  };
  for (const s of suggestions) out[s.state].push(s);
  return out;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SuggestedActivityCard: React.FC<SuggestedActivityCardProps> = ({
  suggestions,
  onPick,
  ctaLabel,
  title = 'Suggested for today',
  asOf = 'Today',
  className,
}) => {
  const grouped = React.useMemo(() => group(suggestions), [suggestions]);

  const isEmpty = suggestions.length === 0;

  return (
    <Card className={className} pad="md">
      <CardHeader>
        <div className="flex flex-col">
          <CardTitle>{title}</CardTitle>
          <CardMeta>{asOf} · based on your active block</CardMeta>
        </div>
      </CardHeader>

      {isEmpty ? (
        <p className="text-body text-ink-muted">
          Nothing to suggest yet. Log a few activities and your rules will fill
          this card in.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {ORDER.map((state) => {
            const rows = grouped[state];
            if (rows.length === 0) return null;
            return (
              <section key={state}>
                <header className="mb-2 flex items-baseline justify-between gap-2">
                  <h4
                    className={cn(
                      'text-label uppercase font-medium tracking-wider',
                      state === 'safe' && 'text-safe-fg',
                      state === 'caution' && 'text-caution-fg',
                      state === 'danger' && 'text-danger-fg',
                    )}
                  >
                    {GROUP_TITLES[state]}
                  </h4>
                  <span className="text-caption text-ink-faint">
                    {rows.length}
                  </span>
                </header>
                <p className="mb-2 text-caption text-ink-muted">
                  {GROUP_SUBS[state]}
                </p>
                <ul className="flex flex-col divide-y divide-border-subtle">
                  {rows.map((s) => (
                    <SuggestionRow
                      key={s.id}
                      suggestion={s}
                      onPick={onPick}
                      ctaLabel={ctaLabel}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

interface SuggestionRowProps {
  suggestion: Suggestion;
  onPick?: (s: Suggestion) => void;
  ctaLabel?: (s: Suggestion) => string;
}

const SuggestionRow: React.FC<SuggestionRowProps> = ({
  suggestion,
  onPick,
  ctaLabel,
}) => {
  const { state, label, reason, nextSafeDate, lastDoneDate } = suggestion;

  // Only `safe` and `caution` get an action — `danger` is informational.
  const canPick = state !== 'danger' && !!onPick;
  const cta =
    ctaLabel?.(suggestion) ??
    (state === 'safe' ? `Log ${label.toLowerCase()}` : 'Log lightly');

  // Meta line composes whatever context we have without becoming a wall of text.
  const meta = [
    lastDoneDate && `Last: ${lastDoneDate}`,
    state !== 'safe' && nextSafeDate && `Safe again: ${nextSafeDate}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <StatusDot
          state={state}
          label={label}
          meta={meta || undefined}
        />
        <p className="mt-1 ml-6 text-caption text-ink-muted">{reason}</p>
      </div>
      {canPick && (
        <button
          type="button"
          onClick={() => onPick?.(suggestion)}
          className={cn(
            'shrink-0 h-9 px-3 rounded-md text-body font-medium transition-colors duration-snap ease-out-quint',
            state === 'safe'
              ? 'bg-safe/15 text-safe-fg hover:bg-safe/25'
              : 'bg-caution/15 text-caution-fg hover:bg-caution/25',
          )}
        >
          {cta}
        </button>
      )}
    </li>
  );
};
