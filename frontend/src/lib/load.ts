// =============================================================================
// load.ts — rolling training-load math
// -----------------------------------------------------------------------------
// One canonical definition of "load" for the whole app. Both the WeeklyLoadGraph
// and the rules engine (weekly_load_cap rule, SuggestedActivityCard rationale)
// MUST funnel through here — if we ever change the formula, we change it once.
//
//   load(log)        = volumeValue * rpe
//   rollingLoad(d,n) = Σ load(log) where loggedDate ∈ [d - (n-1), d]   (inclusive)
//
// A missing `rpe` is treated as the neutral midpoint (5). Treating it as 0 would
// silently under-weight unscored logs, which produces deceptively "safe" graphs.
// =============================================================================

import type { ActivityLog, ID, ISODate, RPE } from '../types';

/** RPE assumed when a log was saved without one. Neutral midpoint of 1–10. */
export const DEFAULT_RPE: RPE = 5;

// -----------------------------------------------------------------------------
// Date helpers — kept local so we don't pull in a date lib for four functions.
// All dates are ISO YYYY-MM-DD strings (calendar dates, no tz drift).
// -----------------------------------------------------------------------------

/** Parse 'YYYY-MM-DD' into a UTC Date at 00:00. Avoids local-tz off-by-one. */
export function parseISODate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

/** Format a Date back to 'YYYY-MM-DD' (UTC). */
export function formatISODate(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add `n` days to an ISO date (n may be negative). */
export function addDays(d: ISODate, n: number): ISODate {
  const dt = parseISODate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return formatISODate(dt);
}

/** Inclusive day count between two ISO dates. `diffDays(d, d) === 1`. */
export function diffDays(from: ISODate, to: ISODate): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Enumerate every date from `start` through `end`, inclusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cursor = start;
  // Guard against reversed ranges — fail loud rather than hang.
  if (parseISODate(end) < parseISODate(start)) return out;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Load primitives
// -----------------------------------------------------------------------------

/** Single-log load. Public so callers can render per-log contributions. */
export function logLoad(log: Pick<ActivityLog, 'volumeValue' | 'rpe'>): number {
  const rpe = log.rpe ?? DEFAULT_RPE;
  return log.volumeValue * rpe;
}

/**
 * Sum of `logLoad` over all logs falling on `date` (one user may log multiple
 * activities the same day).
 */
export function dailyLoad(logs: ActivityLog[], date: ISODate): number {
  let total = 0;
  for (const log of logs) {
    if (log.loggedDate === date) total += logLoad(log);
  }
  return total;
}

/**
 * Rolling load over the `windowDays`-day window ending on `asOf` (inclusive).
 * Example: rollingLoad(logs, '2025-05-25', 7) sums 2025-05-19 .. 2025-05-25.
 */
export function rollingLoad(
  logs: ActivityLog[],
  asOf: ISODate,
  windowDays: number,
): number {
  if (windowDays <= 0) return 0;
  const start = addDays(asOf, -(windowDays - 1));
  let total = 0;
  for (const log of logs) {
    if (log.loggedDate >= start && log.loggedDate <= asOf) {
      total += logLoad(log);
    }
  }
  return total;
}

/** Convenience wrappers — the two windows the design doc calls out by name. */
export const threeDayLoad = (logs: ActivityLog[], asOf: ISODate): number =>
  rollingLoad(logs, asOf, 3);
export const sevenDayLoad = (logs: ActivityLog[], asOf: ISODate): number =>
  rollingLoad(logs, asOf, 7);

// -----------------------------------------------------------------------------
// Series — what charts consume
// -----------------------------------------------------------------------------

export interface LoadPoint {
  date: ISODate;
  /** Rolling load over the chosen window, ending on `date`. */
  load: number;
  /** Raw (non-rolling) load contributed on this single day. */
  dailyLoad: number;
}

/**
 * Build a contiguous daily series of rolling loads between `start` and `end`.
 * Days with no logs still appear (load = 0 contribution that day, but the
 * rolling sum may still be non-zero because of earlier days in the window).
 *
 * Implementation note: O(n·m) is fine at the scales we care about (a training
 * block is ~6 weeks × a handful of logs/day). If we ever push this server-side
 * we can convert to a sliding-window deque for O(n).
 */
export function buildLoadSeries(
  logs: ActivityLog[],
  start: ISODate,
  end: ISODate,
  windowDays = 7,
  filter?: (log: ActivityLog) => boolean,
): LoadPoint[] {
  const scoped = filter ? logs.filter(filter) : logs;
  return eachDay(start, end).map((date) => ({
    date,
    load: rollingLoad(scoped, date, windowDays),
    dailyLoad: dailyLoad(scoped, date),
  }));
}

/** Quick filter helper for class-scoped graphs. */
export const byActivityIds =
  (activityIds: ID[]) =>
  (log: ActivityLog): boolean =>
    activityIds.includes(log.activityId);
