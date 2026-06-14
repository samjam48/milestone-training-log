// =============================================================================
// CalendarHeatmap — block-review grid of DailySafetyScores
// -----------------------------------------------------------------------------
// Renders one cell per day in a training block. Color encodes the per-day
// safety state from the rules engine:
//
//   safe    → green   (no violations, no pain spike)
//   caution → amber   (mild discomfort / pushing-it / soft warning)
//   danger  → red     (rule violation or logged flare-up)
//   neutral → faint   (no data — either pre-block or no logs)
//
// Layout: a column-per-week grid, Monday at the top. We auto-compute the week
// count from the block range, so a 4-week block renders 4 columns, a 6-week
// block renders 6 — no "always 6×7" assumption (the roadmap label is just the
// most common case).
//
// The component is a *pure view*: it does not compute scores itself. Pass in
// a `scores: DailySafetyScore[]` produced by the rules engine. Days missing
// from the array are rendered as `neutral`.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';
import type { DailySafetyScore, ISODate, SafetyState } from '../../types';
import {
  addDays,
  eachDay,
  parseISODate,
} from '../../lib/load';

export interface CalendarHeatmapProps {
  /** Block start (inclusive). */
  startDate: ISODate;
  /** Block end (inclusive). Defaults to today if the block is still active. */
  endDate: ISODate;
  /** Sparse: only days the engine has produced a score for. Others → neutral. */
  scores: DailySafetyScore[];
  /** Optional title. Omit to render the grid without a card chrome. */
  title?: string;
  /** Optional date the user is currently viewing — gets a ring outline. */
  highlightDate?: ISODate;
  /** Tap handler — receives the date string. */
  onCellClick?: (date: ISODate, score: DailySafetyScore | null) => void;
  className?: string;
}

// -----------------------------------------------------------------------------
// Visual mapping. We use Tailwind classes (not inline colors) so the heatmap
// honors theme overrides for free.
// -----------------------------------------------------------------------------

/** Shared colour tokens for heatmap cells. Export so legend swatches
 *  can reuse the same classes — single source of truth. */
export const SAFETY_CELL_CLASSES: Record<'safe' | 'caution' | 'danger', string> = {
  safe:    'bg-safe/70    ring-1 ring-inset ring-safe-border',
  caution: 'bg-caution/70 ring-1 ring-inset ring-caution-border',
  danger:  'bg-danger/70  ring-1 ring-inset ring-danger-border',
};

const cellState: Record<SafetyState | 'neutral', string> = {
  // `bg-*` is the tinted dark surface, ring adds a thin same-hue border so the
  // cell still reads as a discrete tile on the bg-raised card.
  ...SAFETY_CELL_CLASSES,
  neutral: 'bg-bg-sunken  ring-1 ring-inset ring-border-subtle',
};

// Mon–Sun row labels (Monday-first is what trainers expect; the roadmap calls
// out "block review" which is always grouped by training week).
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Mon = 0 ... Sun = 6. JS `getUTCDay()` is Sun = 0, so shift. */
function mondayIndex(d: ISODate): number {
  return (parseISODate(d).getUTCDay() + 6) % 7;
}

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

interface Column {
  /** ISO date for each of the 7 rows; null for cells before block start /
   *  after block end (so the first/last weeks pad cleanly). */
  cells: (ISODate | null)[];
  /** Label shown above the column — week-start month/day. */
  label: string;
}

function buildColumns(start: ISODate, end: ISODate): Column[] {
  // Pad start back to the previous Monday so column 0 row 0 always lines up.
  const paddedStart = addDays(start, -mondayIndex(start));
  const days = eachDay(paddedStart, end);

  const cols: Column[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    while (slice.length < 7) {
      const last = slice[slice.length - 1];
      if (last === undefined) break;
      slice.push(addDays(last, 1));
    }
    cols.push({
      cells: slice.map((d) => (d >= start && d <= end ? d : null)),
      label: shortDateLabel(slice[0] ?? start),
    });
  }
  return cols;
}

function shortDateLabel(d: ISODate): string {
  const dt = parseISODate(d);
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  startDate,
  endDate,
  scores,
  title = 'Block Safety',
  highlightDate,
  onCellClick,
  className,
}) => {
  // Index scores by date for O(1) lookup. Re-derive when inputs change.
  const scoreIndex = React.useMemo(() => {
    const m = new Map<ISODate, DailySafetyScore>();
    for (const s of scores) m.set(s.date, s);
    return m;
  }, [scores]);

  const columns = React.useMemo(
    () => buildColumns(startDate, endDate),
    [startDate, endDate],
  );

  // Roll up totals for the meta line so the card answers "how did the block go?"
  // at a glance even before the user studies the grid.
  const totals = React.useMemo(() => {
    let safe = 0,
      caution = 0,
      danger = 0;
    for (const s of scores) {
      if (s.state === 'safe') safe++;
      else if (s.state === 'caution') caution++;
      else if (s.state === 'danger') danger++;
    }
    return { safe, caution, danger, logged: scores.length };
  }, [scores]);

  return (
    <Card className={className} pad="md">
      <CardHeader>
        <div className="flex flex-col">
          <CardTitle>{title}</CardTitle>
          <CardMeta>
            {shortDateLabel(startDate)} – {shortDateLabel(endDate)} ·{' '}
            {totals.logged} day{totals.logged === 1 ? '' : 's'} logged
          </CardMeta>
        </div>
      </CardHeader>

      <div className="flex gap-2">
        {/* Weekday label column — keeps the grid readable without dates on every cell. */}
        <div className="flex flex-col gap-1 pt-5">
          {WEEKDAY_LABELS.map((l, i) => (
            <span
              key={i}
              className="h-5 w-3 text-micro uppercase text-ink-faint text-center leading-5"
            >
              {l}
            </span>
          ))}
        </div>

        {/* Week columns. `flex-1` so the grid stretches to card width. */}
        <div className="flex gap-1 flex-1 min-w-0">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="h-4 text-micro uppercase text-ink-faint truncate">
                {col.label}
              </span>
              {col.cells.map((date, ri) => {
                if (!date) {
                  // Padding cell (outside block range) — invisible but reserves grid space.
                  return <span key={ri} className="h-5 w-full" aria-hidden="true" />;
                }
                const score = scoreIndex.get(date) ?? null;
                const state: SafetyState | 'neutral' = score?.state ?? 'neutral';
                const interactive = !!onCellClick;
                const isHighlighted = date === highlightDate;
                return (
                  <button
                    key={ri}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onCellClick?.(date, score)}
                    aria-label={`${date}: ${labelForState(state, score)}`}
                    title={`${date} — ${labelForState(state, score)}`}
                    className={cn(
                      'h-5 w-full rounded-sm transition-colors duration-snap ease-out-quint',
                      cellState[state],
                      isHighlighted && 'ring-2 ring-offset-1 ring-offset-bg-raised ring-ink',
                      interactive && 'cursor-pointer hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      !interactive && 'cursor-default',
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + tally. Mirrors the StatusDot vocabulary so the card explains itself. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <StatusDot state="safe"    size="sm" label={`${totals.safe} safe`} />
        <StatusDot state="caution" size="sm" label={`${totals.caution} caution`} />
        <StatusDot state="danger"  size="sm" label={`${totals.danger} flare/violation`} />
      </div>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function labelForState(
  state: SafetyState | 'neutral',
  score: DailySafetyScore | null,
): string {
  if (state === 'neutral') return 'No data';
  if (score?.hadFlareUp) return 'Flare-up logged';
  const v = score?.violations?.length ?? 0;
  if (state === 'safe') return 'Safe';
  if (state === 'caution') return v > 0 ? `${v} warning${v === 1 ? '' : 's'}` : 'Pushing it';
  return v > 0 ? `${v} rule violation${v === 1 ? '' : 's'}` : 'Flare-up';
}
