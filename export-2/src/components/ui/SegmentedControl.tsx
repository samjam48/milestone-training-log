// =============================================================================
// SegmentedControl — generic multi-option picker
// -----------------------------------------------------------------------------
// Used for:
//   • Post-activity feel:  Fine / Discomfort / Bad   (state-tinted)
//   • Yes / No             (boolean toggles in check-in)
//   • Performance / Recovery (activity type)
//
// API is intentionally generic (`options: SegmentedOption<T>[]`) so callers
// pass any value type — string, number, or domain enum.
//
// Visual: a single rounded container with equal-width buttons separated by
// hairlines. Selected segment fills with a subtle raised tint OR a state tint
// when the option declares one.
//
// Hit target ≥44px (height: 48px / 12*4).
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { SafetyState } from '../../types';

export type SegmentTone = SafetyState | 'neutral';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** Optional state tint when selected. Default: 'neutral' (raised ink fill). */
  tone?: SegmentTone;
  /** Small icon shown left of the label. */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  value: T | null;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  /** Visual density. */
  size?: 'sm' | 'md';
  /** Accessible group label. */
  ariaLabel?: string;
  className?: string;
}

// Per-tone classes for the *selected* state. Unselected segments are always
// quiet so the chosen one reads as the clear answer.
const toneSelected: Record<SegmentTone, string> = {
  neutral: 'bg-ink text-ink-inverse',
  safe:    'bg-safe-bg text-safe-fg border-safe-border',
  caution: 'bg-caution-bg text-caution-fg border-caution-border',
  danger:  'bg-danger-bg text-danger-fg border-danger-border',
};

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const heightCls = size === 'sm' ? 'h-10' : 'h-12';
  const textCls   = size === 'sm' ? 'text-caption' : 'text-body';

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-grid w-full rounded-md border border-border bg-bg-sunken p-1',
        'gap-1',
        className,
      )}
      style={{
        // Equal-width columns regardless of label length
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const tone: SegmentTone = opt.tone ?? 'neutral';
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-sm border border-transparent font-medium',
              'transition-colors duration-snap ease-out-quint',
              heightCls,
              textCls,
              // Selected vs unselected
              isSelected
                ? toneSelected[tone]
                : 'text-ink-muted hover:text-ink hover:bg-bg-raised/50',
              // Disabled
              opt.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {opt.icon && <span className="inline-flex">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
