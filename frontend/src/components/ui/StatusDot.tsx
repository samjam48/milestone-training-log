// =============================================================================
// StatusDot — traffic-light indicator
// -----------------------------------------------------------------------------
// Used for: ActivityClass status on the Dashboard, day-cell legend on the
// CalendarHeatmap, inline "is this safe to do?" badges.
//
// Visual: a filled dot with a soft halo (the dot has presence at glance, the
// halo gives it weight without using a colored card). Optional label text.
//
// Variants:
//   solid (default) → filled dot + faint halo
//   pulse           → animated halo for "live" signals (e.g. "due today")
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { SafetyState } from '../../types';

export interface StatusDotProps {
  state: SafetyState | 'neutral';
  /** Optional label shown to the right of the dot. */
  label?: React.ReactNode;
  /** Optional smaller meta line below the label. */
  meta?: React.ReactNode;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'pulse';
  className?: string;
}

const dotColor: Record<NonNullable<StatusDotProps['state']>, string> = {
  neutral: 'bg-ink-faint',
  safe:    'bg-safe',
  caution: 'bg-caution',
  danger:  'bg-danger',
};

const haloColor: Record<NonNullable<StatusDotProps['state']>, string> = {
  neutral: 'bg-ink-faint/20',
  safe:    'bg-safe/25',
  caution: 'bg-caution/25',
  danger:  'bg-danger/25',
};

const textColor: Record<NonNullable<StatusDotProps['state']>, string> = {
  neutral: 'text-ink-muted',
  safe:    'text-safe-fg',
  caution: 'text-caution-fg',
  danger:  'text-danger-fg',
};

export const StatusDot: React.FC<StatusDotProps> = ({
  state,
  label,
  meta,
  size = 'md',
  variant = 'solid',
  className,
}) => {
  const dotPx = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const haloPx = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2.5', className)}
    >
      {/* Dot + halo */}
      <span className={cn('relative inline-flex items-center justify-center', haloPx)}>
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full',
            haloColor[state],
            variant === 'pulse' && 'animate-ping',
          )}
        />
        <span
          aria-hidden="true"
          className={cn('relative rounded-full', dotPx, dotColor[state])}
        />
      </span>

      {(label || meta) && (
        <span className="flex flex-col leading-tight">
          {label && (
            <span className={cn('text-body font-medium', textColor[state])}>
              {label}
            </span>
          )}
          {meta && (
            <span className="text-caption text-ink-muted">{meta}</span>
          )}
        </span>
      )}
    </span>
  );
};
