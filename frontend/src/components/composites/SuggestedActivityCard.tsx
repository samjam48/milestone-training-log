// =============================================================================
// SuggestedActivityCard — dashboard suggestion buckets (do / rest / done)
// -----------------------------------------------------------------------------
// Presentational card consuming pre-computed `suggestion_buckets` from the API.
// Within the Do section, safe/caution sub-groups and CTAs are preserved.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';
import {
  truncateSuggestionDescription,
  type Suggestion,
  type SuggestionBucket,
} from '../../lib/engine';
import type { SafetyState } from '../../types';

export type { Suggestion };

export interface SuggestedActivityCardProps {
  suggestionBuckets: Suggestion[];
  /** When true and buckets are empty, show calm weekly-target-complete copy. */
  allWeeklyTargetsComplete?: boolean;
  onPick?: (s: Suggestion) => void;
  ctaLabel?: (s: Suggestion) => string;
  title?: string;
  asOf?: string;
  className?: string;
}

const DO_STATE_ORDER: SafetyState[] = ['safe', 'caution', 'danger'];

const DO_GROUP_TITLES: Partial<Record<SafetyState, string>> = {
  safe: 'Within your active rules and recent load.',
  caution: 'You\u2019re close to a threshold — keep it short.',
};

function bucketRows(buckets: Suggestion[], bucket: SuggestionBucket): Suggestion[] {
  return buckets.filter((row) => row.bucket === bucket);
}

function groupDoByState(rows: Suggestion[]): Record<SafetyState, Suggestion[]> {
  const out: Record<SafetyState, Suggestion[]> = {
    safe: [],
    caution: [],
    danger: [],
  };
  for (const row of rows) {
    out[row.state].push(row);
  }
  return out;
}

function showDoneForTodayCopy(doRows: Suggestion[], restRows: Suggestion[]): boolean {
  return doRows.length === 0 && (restRows.length > 0 || restRows.length === 0);
}

const WEEKLY_TARGETS_COMPLETE_COPY =
  'Weekly targets met for this week. Nothing else required unless you want to log more.';

export const SuggestedActivityCard: React.FC<SuggestedActivityCardProps> = ({
  suggestionBuckets,
  allWeeklyTargetsComplete = false,
  onPick,
  ctaLabel,
  title = 'Suggested for today',
  asOf = 'Today',
  className,
}) => {
  const doRows = React.useMemo(() => bucketRows(suggestionBuckets, 'do'), [suggestionBuckets]);
  const restRows = React.useMemo(() => bucketRows(suggestionBuckets, 'rest'), [suggestionBuckets]);
  const doneRows = React.useMemo(() => bucketRows(suggestionBuckets, 'done'), [suggestionBuckets]);
  const groupedDo = React.useMemo(() => groupDoByState(doRows), [doRows]);

  const allEmpty = suggestionBuckets.length === 0;
  const doneForToday = showDoneForTodayCopy(doRows, restRows) && !allEmpty;

  return (
    <Card className={className} pad="md">
      <CardHeader>
        <div className="flex flex-col">
          <CardTitle>{title}</CardTitle>
          <CardMeta>{asOf} · based on your active block</CardMeta>
        </div>
      </CardHeader>

      {allEmpty ? (
        allWeeklyTargetsComplete ? (
          <p className="text-body text-ink-muted">{WEEKLY_TARGETS_COMPLETE_COPY}</p>
        ) : (
          <p className="text-body text-ink-muted">
            Nothing to suggest yet. Log a few activities and your rules will fill
            this card in.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <section data-testid="suggestion-section-do">
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-label uppercase font-medium tracking-wider text-safe-fg">
                Do these today
              </h4>
              {doRows.length > 0 && (
                <span className="text-caption text-ink-faint">{doRows.length}</span>
              )}
            </header>

            {doneForToday ? (
              <p className="text-body text-ink-muted">You&apos;re done for today.</p>
            ) : (
              <>
                {DO_STATE_ORDER.map((state) => {
                  const rows = groupedDo[state];
                  if (rows.length === 0) return null;
                  return (
                    <div key={state} className="mb-3 last:mb-0">
                      {state !== 'safe' && (
                        <p
                          className={cn(
                            'mb-2 text-caption',
                            state === 'caution' ? 'text-caution-fg' : 'text-danger-fg',
                          )}
                        >
                          {state === 'caution' ? 'Proceed lightly' : 'High risk'}
                        </p>
                      )}
                      {DO_GROUP_TITLES[state] && (
                        <p className="mb-2 text-caption text-ink-muted">
                          {DO_GROUP_TITLES[state]}
                        </p>
                      )}
                      <ul className="flex flex-col divide-y divide-border-subtle">
                        {rows.map((row) => (
                          <SuggestionRow
                            key={row.id}
                            suggestion={row}
                            onPick={onPick}
                            ctaLabel={ctaLabel}
                            showCta
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </>
            )}
          </section>

          {restRows.length > 0 && (
            <section data-testid="suggestion-section-rest">
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h4 className="text-label uppercase font-medium tracking-wider text-danger-fg">
                  Rest these today
                </h4>
                <span className="text-caption text-ink-faint">{restRows.length}</span>
              </header>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {restRows.map((row) => (
                  <RestRow key={`${row.scope}-${row.id}`} suggestion={row} />
                ))}
              </ul>
            </section>
          )}

          {doneRows.length > 0 && (
            <section data-testid="suggestion-section-done">
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h4 className="text-label uppercase font-medium tracking-wider text-ink-muted">
                  Done today
                </h4>
                <span className="text-caption text-ink-faint">{doneRows.length}</span>
              </header>
              <p className="mb-2 text-caption text-ink-muted">
                Already logged — no action needed.
              </p>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {doneRows.map((row) => (
                  <SuggestionRow key={row.id} suggestion={row} informational />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  );
};

interface SuggestionRowProps {
  suggestion: Suggestion;
  onPick?: (s: Suggestion) => void;
  ctaLabel?: (s: Suggestion) => string;
  showCta?: boolean;
  informational?: boolean;
}

const SuggestionRow: React.FC<SuggestionRowProps> = ({
  suggestion,
  onPick,
  ctaLabel,
  showCta = false,
  informational = false,
}) => {
  const { state, label, reason, nextSafeDate, lastDoneDate } = suggestion;

  const canPick = showCta && state !== 'danger' && !!onPick;
  const cta =
    ctaLabel?.(suggestion) ??
    (state === 'safe' ? `Log ${label.toLowerCase()}` : 'Log lightly');

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
          state={informational ? 'neutral' : state}
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

const RestRow: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
  const { scope, label, reason, description } = suggestion;
  const displayDescription =
    scope === 'class' && description
      ? truncateSuggestionDescription(description)
      : reason;

  return (
    <li className="py-2.5">
      <StatusDot state={suggestion.state} label={label} />
      <p
        className="mt-1 ml-6 text-caption text-ink-muted"
        data-testid={scope === 'class' ? 'suggestion-rest-description' : undefined}
      >
        {displayDescription}
      </p>
    </li>
  );
};
