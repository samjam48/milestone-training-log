// =============================================================================
// ProgressBar — value / target visual
// -----------------------------------------------------------------------------
// Used for: weekly targets (Walk 8/10 km), goals, recovery streaks, etc.
//
// State coloring rules (when `state` is omitted, we infer from progress):
//   0%        → muted (no value yet)
//   1–99%     → safe  (on track)
//   ≥100%     → safe  (target met — still green, not a warning)
//   >= overshootAt (e.g. 120%) → caution
//   >= dangerAt    (e.g. 150%) → danger   (exceeded a sensible cap)
//
// Callers can override `state` explicitly for cases where the engine has
// already computed a safety signal (e.g. weekly load cap nearing breach).
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { SafetyState } from '../../types';

export interface ProgressBarProps {
  /** Current value. */
  value: number;
  /** Target value (the "100%" point). */
  target: number;
  /** Explicit state override; otherwise inferred from value/target. */
  state?: SafetyState | 'neutral';
  /** Where overshoot starts being amber. Default 1.2 (120%). */
  overshootAt?: number;
  /** Where overshoot becomes danger. Default 1.5 (150%). */
  dangerAt?: number;
  /** Visual height. Default 'md'. */
  size?: 'sm' | 'md';
  /** Optional label rendered above the bar. */
  label?: React.ReactNode;
  /** Optional value text shown right of the label. Default `value/target`. */
  valueText?: React.ReactNode;
  className?: string;
}

const fillColor: Record<NonNullable<ProgressBarProps['state']>, string> = {
  neutral: 'bg-ink-faint',
  safe:    'bg-safe',
  caution: 'bg-caution',
  danger:  'bg-danger',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  target,
  state,
  overshootAt = 1.2,
  dangerAt = 1.5,
  size = 'md',
  label,
  valueText,
  className,
}) => {
  const ratio = target > 0 ? value / target : 0;
  // Cap the *fill width* at 100% so overshoot doesn't blow past the track.
  // We signal overshoot via color and the numeric readout instead.
  const fillPct = Math.max(0, Math.min(1, ratio)) * 100;

  const inferredState: NonNullable<ProgressBarProps['state']> =
    value <= 0
      ? 'neutral'
      : ratio >= dangerAt
      ? 'danger'
      : ratio >= overshootAt
      ? 'caution'
      : 'safe';

  const effectiveState = state ?? inferredState;

  return (
    <div className={cn('w-full', className)}>
      {(label || valueText) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <span className="text-body text-ink font-medium">{label}</span>
          )}
          <span className="text-caption font-metric tabular-nums text-ink-muted">
            {valueText ?? `${value}/${target}`}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={target}
        className={cn(
          'w-full overflow-hidden rounded-pill bg-bg-sunken',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <div
          className={cn(
            'h-full rounded-pill transition-[width] duration-snap ease-out-quint',
            fillColor[effectiveState],
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
};
