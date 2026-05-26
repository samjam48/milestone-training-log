// =============================================================================
// Card — layered near-black container
// -----------------------------------------------------------------------------
// The workhorse surface. Three intents:
//   default   → standard raised card (bg-raised + hairline border)
//   inset     → sunken well (forms, graphs, inputs that should "recess")
//   state     → tinted card for safety signals (safe/caution/danger/info)
//
// Padding presets via `pad`: 'none' | 'sm' | 'md' | 'lg' (md = 16px default).
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';

export type CardIntent = 'default' | 'inset' | 'safe' | 'caution' | 'danger' | 'info';
export type CardPad = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  intent?: CardIntent;
  pad?: CardPad;
  /** When true, render with `button` semantics — adds press feedback. */
  interactive?: boolean;
  children: React.ReactNode;
}

const intentStyles: Record<CardIntent, string> = {
  default: 'bg-bg-raised border-border',
  inset:   'bg-bg-sunken  border-border-subtle',
  safe:    'bg-safe-bg    border-safe-border',
  caution: 'bg-caution-bg border-caution-border',
  danger:  'bg-danger-bg  border-danger-border',
  info:    'bg-info-bg    border-info-border',
};

const padStyles: Record<CardPad, string> = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { intent = 'default', pad = 'md', interactive, className, children, ...rest },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border shadow-card',
          intentStyles[intent],
          padStyles[pad],
          interactive &&
            'cursor-pointer transition-colors duration-snap ease-out-quint active:bg-bg-overlay',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

// -----------------------------------------------------------------------------
// CardHeader / CardTitle / CardMeta — tiny composition helpers so callers don't
// reinvent the title row. Optional; Card itself doesn't require them.
// -----------------------------------------------------------------------------

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...rest
}) => (
  <h3 className={cn('text-body-lg font-semibold text-ink', className)} {...rest}>
    {children}
  </h3>
);

export const CardMeta: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className,
  children,
  ...rest
}) => (
  <span className={cn('text-caption text-ink-muted', className)} {...rest}>
    {children}
  </span>
);
