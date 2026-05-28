// =============================================================================
// Slider — 0–10 scored input with hero readout
// -----------------------------------------------------------------------------
// Used for: Morning Check-In (Pain, Readiness, Stiffness, Severity) and the
// Log Activity form (RPE). The big number above the track is the focal point;
// the track itself is restrained.
//
// Behaviour:
// - Native <input type="range"> under the hood for free a11y + touch support
// - Thumb is restyled (cross-browser) to a 24px disc — exceeds the 22px
//   minimum for ergonomic touch on iOS
// - Optional state tint flips the fill + thumb to safe/caution/danger
// - Endpoint labels ("None" / "Severe") sit beneath the track
//
// Inline <style> tag scopes the thumb styling so it doesn't leak.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { SafetyState } from '../../types';

export interface SliderProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Endpoint labels. */
  leftLabel?: string;
  rightLabel?: string;
  /** Suffix shown after the big number (e.g. "/10"). */
  valueSuffix?: string;
  /** Tint the fill + thumb by safety state. */
  state?: SafetyState | 'neutral';
  /** When true, hides the hero number above the track. */
  hideValue?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const thumbVar: Record<NonNullable<SliderProps['state']>, string> = {
  neutral: '#E8ECF1',
  safe:    '#3DD68C',
  caution: '#F5B544',
  danger:  '#FF5A52',
};

const numberColor: Record<NonNullable<SliderProps['state']>, string> = {
  neutral: 'text-ink',
  safe:    'text-safe-fg',
  caution: 'text-caution-fg',
  danger:  'text-danger-fg',
};

export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  leftLabel,
  rightLabel,
  valueSuffix = `/${10}`,
  state = 'neutral',
  hideValue = false,
  disabled = false,
  id,
  className,
}) => {
  const reactId = React.useId();
  const sliderId = id ?? `slider-${reactId}`;
  // Percentage of fill used for the colored portion of the track
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn('w-full', disabled && 'opacity-50', className)}>
      {/* Hero readout */}
      {!hideValue && (
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span
            className={cn(
              'font-metric font-semibold tabular-nums leading-none text-hero',
              numberColor[state],
            )}
          >
            {value}
          </span>
          {valueSuffix && (
            <span className="font-sans text-title text-ink-muted">{valueSuffix}</span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="relative">
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          // Custom-styled native range — see <style> below
          className="ms-slider w-full"
          // CSS custom props consumed by the <style> block
          style={
            {
              ['--ms-fill' as string]: `${pct}%`,
              ['--ms-fill-color' as string]: thumbVar[state],
            } as React.CSSProperties
          }
        />
      </div>

      {/* Endpoint labels */}
      {(leftLabel || rightLabel) && (
        <div className="mt-1.5 flex justify-between text-caption text-ink-muted">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}

      {/*
        Scoped slider styles. We can't express ::-webkit-slider-thumb in
        Tailwind, so a tiny stylesheet here is unavoidable. Keep it minimal.
      */}
      <style>{`
        .ms-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 999px;
          /* Two-stop gradient: filled portion (state color) + empty (sunken bg) */
          background: linear-gradient(
            to right,
            var(--ms-fill-color) 0%,
            var(--ms-fill-color) var(--ms-fill),
            #070809 var(--ms-fill),
            #070809 100%
          );
          outline: none;
          cursor: pointer;
        }
        .ms-slider:focus-visible {
          box-shadow: 0 0 0 2px rgba(232, 236, 241, 0.25);
        }
        /* WebKit thumb */
        .ms-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: #E8ECF1;
          border: 3px solid var(--ms-fill-color);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
          cursor: grab;
          transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ms-slider:active::-webkit-slider-thumb {
          transform: scale(1.1);
          cursor: grabbing;
        }
        /* Firefox thumb */
        .ms-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: #E8ECF1;
          border: 3px solid var(--ms-fill-color);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
          cursor: grab;
        }
        .ms-slider::-moz-range-track {
          height: 8px;
          border-radius: 999px;
          background: transparent;
        }
      `}</style>
    </div>
  );
};
