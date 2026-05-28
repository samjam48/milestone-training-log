// =============================================================================
// Tier 2 — Domain Composites barrel
// -----------------------------------------------------------------------------
// Re-export every composite so callers can do:
//   import { CalendarHeatmap, WeeklyLoadGraph } from '@/components/composites';
// =============================================================================

export { CalendarHeatmap } from './CalendarHeatmap';
export type { CalendarHeatmapProps } from './CalendarHeatmap';

export { WeeklyLoadGraph } from './WeeklyLoadGraph';
export type { WeeklyLoadGraphProps } from './WeeklyLoadGraph';

export { RuleViolationBanner } from './RuleViolationBanner';
export type { RuleViolationBannerProps } from './RuleViolationBanner';

export { SuggestedActivityCard } from './SuggestedActivityCard';
export type {
  SuggestedActivityCardProps,
  Suggestion,
} from './SuggestedActivityCard';
