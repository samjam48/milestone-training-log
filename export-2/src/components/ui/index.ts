// =============================================================================
// Tier 1 — UI Primitives barrel
// -----------------------------------------------------------------------------
// Re-export every primitive so callers can do:
//   import { Card, ProgressBar, StatusDot } from '@/components/ui'
// =============================================================================

export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';

export { BottomTabBar } from './BottomTabBar';
export type { BottomTabBarProps, TabKey } from './BottomTabBar';

export { Card, CardHeader, CardTitle, CardMeta } from './Card';
export type { CardProps, CardIntent, CardPad } from './Card';

export { Metric } from './Metric';
export type { MetricProps, MetricSize } from './Metric';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { StatusDot } from './StatusDot';
export type { StatusDotProps } from './StatusDot';

export { Slider } from './Slider';
export type { SliderProps } from './Slider';

export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedOption, SegmentTone } from './SegmentedControl';

export { ActivityLogRow } from './ActivityLogRow';
export type { ActivityLogRowProps } from './ActivityLogRow';
