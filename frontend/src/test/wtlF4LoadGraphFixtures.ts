/**
 * WTL.F4 — Dashboard load-tax graph fixtures.
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F4
 */
import { addDays, eachDay, type LoadPoint } from '../lib/load';
import type { ActivityClass, ISODate } from '../types';

export const WTL_F4_AS_OF = '2026-06-07' as ISODate;
export const WTL_F4_GRAPH_WINDOW_DAYS = 30;
export const WTL_F4_GRAPH_START = addDays(WTL_F4_AS_OF, -(WTL_F4_GRAPH_WINDOW_DAYS - 1));
export const WTL_F4_BLOCK_START = '2026-04-07' as ISODate;
export const WTL_F4_FLARE_DATE = '2026-06-03' as ISODate;
export const WTL_F4_LATEST_LOAD = 42;

export const WTL_F4_SUBTITLE = 'Rolling 7-day effort load · last 30 days';

export const WTL_F4_FORMULA_COPY =
  'Performance sessions weighted by effort, rule pressure, and recency';

export const WTL_F4_CLASS_FOOT: ActivityClass = {
  id: 'cls-wtl-f4-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  loadWeight: 1,
  createdAt: '2026-04-07T06:00:00Z',
};

/** Contiguous 30-day load-tax series ending on as-of (matches WTL.B5 window). */
export function buildWtlF4LoadSeries(
  endDate: ISODate = WTL_F4_AS_OF,
  pointCount: number = WTL_F4_GRAPH_WINDOW_DAYS,
): LoadPoint[] {
  const start = addDays(endDate, -(pointCount - 1));
  return eachDay(start, endDate).map((date, index) => ({
    date,
    load: index === pointCount - 1 ? WTL_F4_LATEST_LOAD : 10 + index * 0.3,
    dailyLoad: index === pointCount - 1 ? 6 : 0,
  }));
}

export const wtlF4LoadSeries = buildWtlF4LoadSeries();

export const wtlF4LoadSeriesSnake = wtlF4LoadSeries.map((point) => ({
  date: point.date,
  load: point.load,
  daily_load: point.dailyLoad,
}));
