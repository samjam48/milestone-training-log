// =============================================================================
// Metric — big tabular numeric readout
// -----------------------------------------------------------------------------
// Renders a primary number (JetBrains Mono, tabular figures) with an optional
// unit suffix and a small caption above. Designed for the dashboard hero
// numbers, weekly target totals, and the check-in slider values.
//
// Sizes:
//   sm   → inline number inside a row              (text-title  / 20px)
//   md   → standard metric card                    (text-metric / 40px)
//   lg   → hero readout (e.g. live slider value)   (text-hero   / 56px)
//
// State tints recolor the *number* itself; the unit + caption stay muted so
// the eye lands on the digit first.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { SafetyState } from '../../types';

export type MetricSize = 'sm' | 'md' | 'lg';

export interface MetricProps {
  /** Numeric value. Pass a pre-formatted string if you need custom formatting. */
  value: number | string;
  /** Short unit suffix — "km", "/10", "min", "sessions". */
  unit?: string;
  /** Caption above the number — typically an uppercase SectionLabel-ish line. */
  caption?: string;
  /** Optional secondary text shown to the right of the unit. */
  trend?: React.ReactNode;
  size?: MetricSize;
  /** Tint the number itself by safety state. */
  state?: SafetyState | 'neutral';
  className?: string;
}

const sizeStyles: Record<MetricSize, { num: string; unit: string }> = {
  sm: { num: 'text-title',  unit: 'text-body  ml-1' },
  md: { num: 'text-metric', unit: 'text-body-lg ml-1.5' },
  lg: { num: 'text-hero',   unit: 'text-title ml-2' },
};

const stateColor: Record<NonNullable<MetricProps['state']>, string> = {
  neutral: 'text-ink',
  safe:    'text-safe-fg',
  caution: 'text-caution-fg',
  danger:  'text-danger-fg',
};

export const Metric: React.FC<MetricProps> = ({
  value,
  unit,
  caption,
  trend,
  size = 'md',
  state = 'neutral',
  className,
}) => {
  const sz = sizeStyles[size];
  return (
    <div className={cn('flex flex-col', className)}>
      {caption && (
        <span className="text-label uppercase font-medium text-ink-muted mb-1">
          {caption}
        </span>
      )}
      <div className="flex items-baseline">
        <span
          // `tabular-nums` is critical — numbers shouldn't reflow as they tick.
          // JetBrains Mono is already monospace but we belt-and-brace it.
          className={cn(
            'font-metric font-semibold tabular-nums leading-none',
            sz.num,
            stateColor[state],
          )}
        >
          {value}
        </span>
        {unit && (
          <span className={cn('font-sans text-ink-muted', sz.unit)}>
            {unit}
          </span>
        )}
        {trend && (
          <span className="ml-auto text-caption text-ink-muted">{trend}</span>
        )}
      </div>
    </div>
  );
};
