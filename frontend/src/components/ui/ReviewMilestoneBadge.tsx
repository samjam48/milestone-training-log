import * as React from 'react';

import { cn } from '../../lib/cn';

export const REVIEW_MILESTONE_LABEL = 'Review milestone reached';

export interface ReviewMilestoneBadgeProps {
  /** Icon-only row indicator with accessible name (e.g. previous-block list). */
  compact?: boolean;
  className?: string;
}

export function ReviewMilestoneBadge({
  compact = false,
  className,
}: ReviewMilestoneBadgeProps): React.ReactElement {
  if (compact) {
    return (
      <span
        role="img"
        aria-label={REVIEW_MILESTONE_LABEL}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full',
          'h-6 w-6 bg-safe/15 text-safe-fg',
          className,
        )}
      >
        <span className="sr-only">{REVIEW_MILESTONE_LABEL}</span>
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill px-2 py-0.5',
        'text-caption font-medium bg-safe/15 text-safe-fg',
        className,
      )}
    >
      {REVIEW_MILESTONE_LABEL}
    </span>
  );
}
