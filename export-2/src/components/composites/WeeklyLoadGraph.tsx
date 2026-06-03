// =============================================================================
// WeeklyLoadGraph — rolling load vs. threshold + flare-up markers
// -----------------------------------------------------------------------------
// Renders an SVG line chart of rolling load (default 7-day window) across a
// date range, with:
//
//   • A dashed horizontal threshold line — the weekly_load_cap rule value.
//   • A filled area below the curve, tinted by current state:
//       safe    → load < 0.8 × threshold
//       caution → 0.8 × threshold ≤ load < threshold
//       danger  → load ≥ threshold
//     Tint is based on the *last* point's state — that's "what should I feel
//     looking at this graph right now?".
//   • Red disc markers on days flagged in `flareUpDates`.
//
// We compute the series here from `logs` + `windowDays` via lib/load.ts so the
// caller only owns the raw data. If you already have a pre-built series, pass
// `series` instead and we'll skip the recompute.
//
// Chart is rendered as an SVG with a viewBox so it scales fluidly inside its
// parent — no ResizeObserver needed. CSS controls width; aspect ratio is fixed
// by the viewBox.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { Metric } from '../ui/Metric';
import type { ActivityLog, ISODate, SafetyState } from '../../types';
import {
  buildLoadSeries,
  LoadPoint,
  parseISODate,
} from '../../lib/load';

export interface WeeklyLoadGraphProps {
  /** Date range to plot (inclusive). */
  startDate: ISODate;
  endDate: ISODate;
  /** Source logs — used to compute the rolling series if `series` is omitted. */
  logs?: ActivityLog[];
  /** Pre-computed series. If present, `logs` is ignored. */
  series?: LoadPoint[];
  /** Rolling-window size. Defaults to 7 (matches our weekly cap rule). */
  windowDays?: number;
  /** Weekly load cap from the active Training Block's rule. */
  threshold: number;
  /** Dates the user logged a FlareUpIncident — rendered as red discs. */
  flareUpDates?: ISODate[];
  /** Card title. */
  title?: string;
  /** Optional subtitle (e.g. activity class scope). */
  subtitle?: string;
  className?: string;
}

// -----------------------------------------------------------------------------
// Layout constants. viewBox units, NOT pixels — actual size is set by the CSS
// width. Aspect ratio ~ 16:7 reads well in a phone card.
// -----------------------------------------------------------------------------

const VB_W = 320;
const VB_H = 140;
const PAD_L = 28;   // left gutter — y-axis labels
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 22;   // bottom gutter — x-axis labels
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

// Caution band starts at 80% of threshold — gives the user a "you're nearing
// the cap" signal before they breach it. Tunable; matches DESIGN.md's
// "pushing it" definition.
const CAUTION_RATIO = 0.8;

function stateForLoad(load: number, threshold: number): SafetyState {
  if (load >= threshold) return 'danger';
  if (load >= threshold * CAUTION_RATIO) return 'caution';
  return 'safe';
}

// SafetyState → SVG fill/stroke classes. Stays in lockstep with ProgressBar.
const stroke: Record<SafetyState, string> = {
  safe:    'stroke-safe',
  caution: 'stroke-caution',
  danger:  'stroke-danger',
};
const fill: Record<SafetyState, string> = {
  safe:    'fill-safe/15',
  caution: 'fill-caution/20',
  danger:  'fill-danger/25',
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const WeeklyLoadGraph: React.FC<WeeklyLoadGraphProps> = ({
  startDate,
  endDate,
  logs,
  series,
  windowDays = 7,
  threshold,
  flareUpDates = [],
  title = 'Weekly Load',
  subtitle,
  className,
}) => {
  // Resolve the data series. Memoized so we only recompute when inputs change.
  const data = React.useMemo<LoadPoint[]>(() => {
    if (series && series.length > 0) return series;
    if (!logs) return [];
    return buildLoadSeries(logs, startDate, endDate, windowDays);
  }, [series, logs, startDate, endDate, windowDays]);

  // y-domain: 0 → max(threshold * 1.2, max load) so the threshold line is always
  // visible AND a breach doesn't get clipped at the top.
  const maxLoad = data.reduce((m, p) => Math.max(m, p.load), 0);
  const yMax = Math.max(threshold * 1.2, maxLoad, 1);

  // x scale: index-based, evenly spaced (one tick per day).
  const n = data.length;
  const xAt = (i: number): number =>
    n <= 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W;
  const yAt = (v: number): number => PAD_T + PLOT_H - (v / yMax) * PLOT_H;

  // Build path strings.
  const linePath = data.length === 0
    ? ''
    : data
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.load).toFixed(2)}`)
        .join(' ');

  const areaPath = data.length === 0
    ? ''
    : `${linePath} L ${xAt(n - 1).toFixed(2)} ${yAt(0).toFixed(2)} L ${xAt(0).toFixed(2)} ${yAt(0).toFixed(2)} Z`;

  // Current state = state of the most recent point (what the user feels NOW).
  const latest = data[data.length - 1];
  const currentState: SafetyState = latest
    ? stateForLoad(latest.load, threshold)
    : 'safe';

  // Flare-up markers: index by date for O(1) lookup against the series.
  const flareSet = React.useMemo(() => new Set(flareUpDates), [flareUpDates]);

  // x-axis ticks: first, middle, last — keeps the axis legible at phone width.
  const xTickIndices = data.length <= 2
    ? data.map((_, i) => i)
    : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <Card className={className} pad="md">
      <CardHeader>
        <div className="flex flex-col">
          <CardTitle>{title}</CardTitle>
          {subtitle && <CardMeta>{subtitle}</CardMeta>}
        </div>
        <Metric
          size="sm"
          state={currentState}
          value={latest ? Math.round(latest.load) : 0}
          unit={`/ ${Math.round(threshold)}`}
          caption={`${windowDays}d load`}
        />
      </CardHeader>

      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${windowDays}-day rolling load from ${startDate} to ${endDate}`}
          preserveAspectRatio="none"
        >
          {/* Plot background — sunken well so the line has contrast. */}
          <rect
            x={PAD_L}
            y={PAD_T}
            width={PLOT_W}
            height={PLOT_H}
            className="fill-bg-sunken"
            rx={4}
          />

          {/* Y-axis gridlines + labels at 0, ½ threshold, threshold. */}
          {[0, threshold / 2, threshold].map((v, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={PAD_L + PLOT_W}
                y1={yAt(v)}
                y2={yAt(v)}
                className={cn(
                  'stroke-border-subtle',
                  v === threshold && 'stroke-caution-border',
                )}
                strokeWidth={v === threshold ? 1 : 0.5}
                strokeDasharray={v === threshold ? '4 3' : undefined}
              />
              <text
                x={PAD_L - 4}
                y={yAt(v) + 3}
                textAnchor="end"
                className="fill-ink-faint font-metric"
                style={{ fontSize: 8 }}
              >
                {Math.round(v)}
              </text>
            </g>
          ))}

          {/* Threshold annotation — small "cap" tag at the dashed line's right end. */}
          <text
            x={PAD_L + PLOT_W - 4}
            y={yAt(threshold) - 4}
            textAnchor="end"
            className="fill-caution-fg uppercase"
            style={{ fontSize: 7, letterSpacing: '0.08em' }}
          >
            cap
          </text>

          {/* Area fill under the curve. */}
          <path d={areaPath} className={fill[currentState]} />

          {/* Load line. */}
          <path
            d={linePath}
            className={stroke[currentState]}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Per-day dots — subtle, so the line still dominates. */}
          {data.map((p, i) => (
            <circle
              key={`d-${i}`}
              cx={xAt(i)}
              cy={yAt(p.load)}
              r={1.4}
              className={stroke[stateForLoad(p.load, threshold)]}
              strokeWidth={1}
              fill="currentColor"
            />
          ))}

          {/* Flare-up markers: red disc + outer ring so they pop above the line. */}
          {data.map((p, i) =>
            flareSet.has(p.date) ? (
              <g key={`f-${i}`}>
                <circle
                  cx={xAt(i)}
                  cy={yAt(p.load)}
                  r={5}
                  className="fill-danger/20"
                />
                <circle
                  cx={xAt(i)}
                  cy={yAt(p.load)}
                  r={3}
                  className="fill-danger stroke-bg-raised"
                  strokeWidth={1}
                >
                  <title>Flare-up logged on {p.date}</title>
                </circle>
              </g>
            ) : null,
          )}

          {/* X-axis labels — short day-of-month, sparse. */}
          {xTickIndices.map((i) => (
            <text
              key={`x-${i}`}
              x={xAt(i)}
              y={VB_H - 6}
              textAnchor="middle"
              className="fill-ink-faint"
              style={{ fontSize: 8 }}
            >
              {shortLabel(data[i].date)}
            </text>
          ))}
        </svg>
      )}

      {/* Legend row — explains the dashed line and the red dots in one breath. */}
      <div className="mt-3 flex items-center gap-4 text-caption text-ink-muted">
        <LegendSwatch className="bg-caution" dashed />
        <span>Weekly cap</span>
        <LegendSwatch className="bg-danger" round />
        <span>Flare-up</span>
      </div>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Bits & pieces
// -----------------------------------------------------------------------------

const LegendSwatch: React.FC<{ className: string; dashed?: boolean; round?: boolean }> = ({
  className,
  dashed,
  round,
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-block',
      round ? 'h-2 w-2 rounded-full' : 'h-0.5 w-4',
      dashed && 'opacity-80',
      className,
    )}
    style={dashed ? { backgroundImage: 'none' } : undefined}
  />
);

const EmptyChart: React.FC = () => (
  <div className="flex h-32 items-center justify-center text-caption text-ink-faint">
    No load data in range
  </div>
);

function shortLabel(d: ISODate): string {
  const dt = parseISODate(d);
  return dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
